import { Prisma, Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../lib/audit.js'

const router = Router()
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

class OrderError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

router.use(requireAuth, requireRole(Role.STORE_MANAGER, Role.ADMIN))

const orderInclude = {
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, packageSize: true } } } },
} satisfies Prisma.PurchaseOrderInclude

router.get('/', async (_request, response) => {
  const orders = await prisma.purchaseOrder.findMany({ include: orderInclude, orderBy: { createdAt: 'desc' }, take: 50 })
  response.json({
    orders: orders.map((order) => ({
      ...order,
      totalCents: order.items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0),
    })),
  })
})

// Suggest quantities for low-stock products using 30-day sales velocity.
router.get('/suggestions', async (_request, response) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [lowStock, sold] = await Promise.all([
    prisma.$queryRaw<{ id: string; sku: string; name: string; packageSize: string | null; quantityOnHand: number; reorderLevel: number; costCents: number }[]>`
      SELECT id::text AS id, sku, name, "packageSize", "quantityOnHand", "reorderLevel", "costCents"
      FROM "Product" WHERE "active" = true AND "quantityOnHand" <= "reorderLevel" ORDER BY "quantityOnHand" ASC, name ASC`,
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { status: 'COMPLETED', createdAt: { gte: since } } },
      _sum: { quantity: true },
    }),
  ])
  const soldByProduct = new Map(sold.map((row) => [row.productId, row._sum.quantity ?? 0]))
  const lastSuppliers = await prisma.stockMovement.findMany({
    where: { type: 'RECEIPT', supplierId: { not: null }, productId: { in: lowStock.map((product) => product.id) } },
    select: { productId: true, supplier: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const supplierByProduct = new Map<string, { id: string; name: string }>()
  for (const movement of lastSuppliers) if (movement.supplier && !supplierByProduct.has(movement.productId)) supplierByProduct.set(movement.productId, movement.supplier)

  response.json({
    suggestions: lowStock.map((product) => {
      const dailyRate = (soldByProduct.get(product.id) ?? 0) / 30
      // Aim for two weeks of sales, and never less than double the reorder level.
      const target = Math.max(product.reorderLevel * 2, Math.ceil(dailyRate * 14), 1)
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        packageSize: product.packageSize,
        quantityOnHand: product.quantityOnHand,
        reorderLevel: product.reorderLevel,
        unitCostCents: product.costCents,
        suggestedQuantity: Math.max(target - product.quantityOnHand, 1),
        lastSupplier: supplierByProduct.get(product.id) ?? null,
      }
    }),
  })
})

router.post('/', async (request, response) => {
  const { supplierId, notes, items } = request.body ?? {}
  if (
    typeof supplierId !== 'string' || !uuidPattern.test(supplierId) ||
    (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 500)) ||
    !Array.isArray(items) || items.length < 1 || items.length > 100
  ) {
    response.status(400).json({ error: 'Choose a supplier and add 1 to 100 product lines.' })
    return
  }

  const lines: { productId: string; quantity: number; unitCostCents: number }[] = []
  const seen = new Set<string>()
  for (const line of items) {
    const cents = typeof line?.unitCostEtb === 'number' ? Math.round(line.unitCostEtb * 100) : NaN
    if (
      typeof line?.productId !== 'string' || !uuidPattern.test(line.productId) || seen.has(line.productId) ||
      !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1_000_000 ||
      !Number.isSafeInteger(cents) || cents < 0 || cents > 1_000_000_000
    ) {
      response.status(400).json({ error: 'Each line needs a unique product, a whole quantity, and a valid unit cost.' })
      return
    }
    seen.add(line.productId)
    lines.push({ productId: line.productId, quantity: line.quantity, unitCostCents: cents })
  }

  const [supplier, productCount] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }),
    prisma.product.count({ where: { id: { in: lines.map((line) => line.productId) }, active: true } }),
  ])
  if (!supplier || productCount !== lines.length) {
    response.status(404).json({ error: 'Supplier or one of the products was not found.' })
    return
  }

  const actorId = response.locals.authUser.id as string
  const order = await prisma.$transaction(async (transaction) => {
    const created = await transaction.purchaseOrder.create({
      data: { supplierId, notes: typeof notes === 'string' ? notes.trim() || null : null, createdById: actorId, items: { create: lines } },
      include: orderInclude,
    })
    await writeAudit({ actorId, action: 'PURCHASE_ORDER_CREATED', entity: 'PurchaseOrder', entityId: created.id, details: { lines: lines.length }, request }, transaction)
    return created
  })
  response.status(201).json({ order })
})

router.patch('/:id/status', async (request, response) => {
  const id = String(request.params.id)
  const status = request.body?.status
  if (!uuidPattern.test(id) || (status !== 'ORDERED' && status !== 'CANCELLED')) {
    response.status(400).json({ error: 'Set the status to ORDERED or CANCELLED.' })
    return
  }
  // Only valid transitions match, which also guards against double-clicks.
  const allowedFrom = status === 'ORDERED' ? ['DRAFT' as const] : ['DRAFT' as const, 'ORDERED' as const]
  const updated = await prisma.purchaseOrder.updateMany({
    where: { id, status: { in: allowedFrom } },
    data: { status, ...(status === 'ORDERED' ? { orderedAt: new Date() } : {}) },
  })
  if (updated.count !== 1) {
    response.status(409).json({ error: 'This order cannot move to that status.' })
    return
  }
  await writeAudit({ actorId: response.locals.authUser.id, action: `PURCHASE_ORDER_${status}`, entity: 'PurchaseOrder', entityId: id, request })
  response.json({ ok: true })
})

// Receiving books every line into stock once; the fixed key makes retries safe.
router.post('/:id/receive', async (request, response) => {
  const id = String(request.params.id)
  if (!uuidPattern.test(id)) {
    response.status(400).json({ error: 'Invalid order ID.' })
    return
  }
  const actorId = response.locals.authUser.id as string
  try {
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.purchaseOrder.updateMany({ where: { id, status: 'ORDERED' }, data: { status: 'RECEIVED', receivedAt: new Date() } })
      if (claimed.count !== 1) throw new OrderError(409, 'Only orders marked as ordered can be received.')
      const order = await transaction.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { items: true } })
      const shift = await transaction.shift.findFirst({ where: { status: 'OPEN' }, select: { id: true } })
      const batch = await transaction.stockMovementBatch.create({
        data: { idempotencyKey: `po-${id}`, requestHash: `po-${id}`, type: 'RECEIPT', supplierId: order.supplierId, shiftId: shift?.id, reference: `PO ${id.slice(0, 8)}`, createdById: actorId },
      })
      for (const item of order.items) {
        await transaction.product.update({ where: { id: item.productId }, data: { quantityOnHand: { increment: item.quantity } } })
        await transaction.stockMovement.create({
          data: { batchId: batch.id, productId: item.productId, type: 'RECEIPT', quantityDelta: item.quantity, reference: batch.reference, supplierId: order.supplierId, shiftId: shift?.id, createdById: actorId },
        })
      }
      await writeAudit({ actorId, action: 'PURCHASE_ORDER_RECEIVED', entity: 'PurchaseOrder', entityId: id, details: { lines: order.items.length }, request }, transaction)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    response.json({ ok: true })
  } catch (error) {
    if (error instanceof OrderError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error.code === 'P2034' || error.code === 'P2002')) {
      response.status(409).json({ error: 'This order was changed at the same time. Refresh and check its status.' })
      return
    }
    throw error
  }
})

export default router
