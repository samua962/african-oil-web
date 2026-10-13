import { createHash } from 'node:crypto'
import { Prisma, Role, StockMovementType } from '@prisma/client'
import { Router, type Request, type Response } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../lib/audit.js'

const router = Router()
const editRoles = [Role.STORE_MANAGER, Role.ADMIN]
const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

class MovementError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

type MovementInput = {
  idempotencyKey: string
  supplierId?: string
  reference: string | null
  reason: string | null
  items: { productId: string; quantity: number; lotNumber?: string; expiryDate?: string }[]
}

router.get('/', requireAuth, async (request, response) => {
  const type = typeof request.query.type === 'string' ? request.query.type : undefined
  if (type && type !== StockMovementType.RECEIPT && type !== StockMovementType.LOSS) {
    response.status(400).json({ error: 'Filter by RECEIPT or LOSS.' })
    return
  }
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(request.query.pageSize ?? '50'), 10) || 50))
  const where = { ...(type ? { type: type as StockMovementType } : {}) }
  const [movements, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, packageSize: true } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, username: true } },
        batch: { select: { id: true, reference: true, reason: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ])
  response.json({ movements, page, pageSize, total, totalPages: Math.ceil(total / pageSize) })
})

router.post('/receipts', requireAuth, requireRole(...editRoles), async (request, response) => {
  await submitMovement(request, response, StockMovementType.RECEIPT)
})

router.post('/losses', requireAuth, requireRole(...editRoles), async (request, response) => {
  await submitMovement(request, response, StockMovementType.LOSS)
})

async function submitMovement(request: Request, response: Response, type: StockMovementType) {
  try {
    const parsed = parseInput(request.body, type)
    const createdById = response.locals.authUser.id as string
    const requestHash = createHash('sha256').update(JSON.stringify({ type, ...parsed })).digest('hex')
    const result = await prisma.$transaction(async (transaction) => {
      const previous = await transaction.stockMovementBatch.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { movements: { include: { product: true, supplier: true, createdBy: true } } },
      })
      if (previous) {
        if (previous.requestHash !== requestHash) throw new MovementError(409, 'This retry key was already used with different movement details. Refresh and start a new movement.')
        return { batch: previous, replayed: true }
      }

      if (parsed.supplierId) {
        const supplier = await transaction.supplier.findUnique({ where: { id: parsed.supplierId }, select: { id: true } })
        if (!supplier) throw new MovementError(404, 'Supplier not found.')
      }

      const activeShift = await transaction.shift.findFirst({
        where: { status: 'OPEN' },
        select: { id: true },
      })

      const products = await transaction.product.findMany({
        where: { id: { in: parsed.items.map((item) => item.productId) }, active: true },
        select: { id: true, name: true, sku: true, quantityOnHand: true },
      })
      if (products.length !== parsed.items.length) throw new MovementError(404, 'One or more products were not found or are inactive.')
      const productById = new Map(products.map((product) => [product.id, product]))

      const batch = await transaction.stockMovementBatch.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          requestHash,
          type,
          supplierId: parsed.supplierId,
          shiftId: activeShift?.id,
          reason: parsed.reason,
          reference: parsed.reference,
          createdById,
        },
      })

      for (const item of parsed.items) {
        const product = productById.get(item.productId)!
        const quantityDelta = type === StockMovementType.RECEIPT ? item.quantity : -item.quantity
        const update = await transaction.product.updateMany({
          where: {
            id: item.productId,
            active: true,
            ...(type === StockMovementType.LOSS ? { quantityOnHand: { gte: item.quantity } } : {}),
          },
          data: { quantityOnHand: { increment: quantityDelta } },
        })
        if (update.count !== 1) {
          throw new MovementError(409, `Not enough stock for ${product.name} (${product.sku}). Available: ${product.quantityOnHand}.`)
        }

        await transaction.stockMovement.create({
          data: {
            batchId: batch.id,
            productId: item.productId,
            type,
            quantityDelta,
            reason: parsed.reason,
            reference: parsed.reference,
            supplierId: parsed.supplierId,
            shiftId: activeShift?.id,
            createdById,
          },
        })
        if (type === StockMovementType.RECEIPT && (item.lotNumber || item.expiryDate)) {
          await transaction.productBatch.create({
            data: {
              productId: item.productId,
              lotNumber: item.lotNumber,
              expiryDate: item.expiryDate ? new Date(`${item.expiryDate}T00:00:00Z`) : null,
              quantityReceived: item.quantity,
              quantityRemaining: item.quantity,
            },
          })
        }
      }

      await writeAudit({
        actorId: createdById,
        action: type === StockMovementType.RECEIPT ? 'STOCK_RECEIVED' : 'STOCK_LOSS_RECORDED',
        entity: 'StockMovementBatch',
        entityId: batch.id,
        details: { reason: parsed.reason, reference: parsed.reference, lines: parsed.items.length, units: parsed.items.reduce((sum, item) => sum + item.quantity, 0) },
        request,
      }, transaction)

      const createdBatch = await transaction.stockMovementBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: { movements: { include: { product: true, supplier: true, createdBy: true } } },
      })
      return { batch: createdBatch, replayed: false }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    response.status(result.replayed ? 200 : 201).json(result)
  } catch (error) {
    if (error instanceof MovementError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json({ error: 'A movement with this retry key was submitted at the same time. Refresh the movement history before retrying.' })
      return
    }
    if (isPrismaError(error, 'P2034')) {
      response.status(409).json({ error: 'Stock changed while this movement was being recorded. Refresh and try again.' })
      return
    }
    throw error
  }
}

function parseInput(body: unknown, type: StockMovementType): MovementInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MovementError(400, 'Provide valid movement details.')
  const input = body as Record<string, unknown>
  const { idempotencyKey, supplierId, reference, reason, items } = input
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 100) {
    throw new MovementError(400, 'A valid retry key is required. Refresh the form and try again.')
  }
  if (type === StockMovementType.RECEIPT && (typeof supplierId !== 'string' || !productIdPattern.test(supplierId))) {
    throw new MovementError(400, 'Select a valid supplier for this receipt.')
  }
  if (type === StockMovementType.LOSS && (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500)) {
    throw new MovementError(400, 'Enter a reason for the loss or damage adjustment.')
  }
  if (reference !== undefined && reference !== null && (typeof reference !== 'string' || reference.trim().length > 100)) {
    throw new MovementError(400, 'Reference must be 100 characters or fewer.')
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    throw new MovementError(400, 'A movement must contain between 1 and 50 product lines.')
  }

  const parsedItems: MovementInput['items'] = []
  const seenProducts = new Set<string>()
  for (const line of items) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw new MovementError(400, 'Each product line must include a product and quantity.')
    const item = line as Record<string, unknown>
    if (typeof item.productId !== 'string' || !productIdPattern.test(item.productId)) throw new MovementError(400, 'Select a valid product for every line.')
    if (!Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 1_000_000) {
      throw new MovementError(400, 'Quantities must be whole numbers between 1 and 1,000,000.')
    }
    if (seenProducts.has(item.productId)) throw new MovementError(400, 'A product can appear only once in a movement.')
    seenProducts.add(item.productId)
    if (item.lotNumber !== undefined && item.lotNumber !== null && item.lotNumber !== '' && (typeof item.lotNumber !== 'string' || item.lotNumber.trim().length > 60)) {
      throw new MovementError(400, 'Lot numbers must be 60 characters or fewer.')
    }
    if (item.expiryDate !== undefined && item.expiryDate !== null && item.expiryDate !== '' && (typeof item.expiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate) || Number.isNaN(Date.parse(item.expiryDate)))) {
      throw new MovementError(400, 'Expiry dates must use the YYYY-MM-DD format.')
    }
    const lotNumber = typeof item.lotNumber === 'string' ? item.lotNumber.trim() : ''
    const expiryDate = typeof item.expiryDate === 'string' ? item.expiryDate : ''
    parsedItems.push({
      productId: item.productId,
      quantity: item.quantity as number,
      ...(type === StockMovementType.RECEIPT && lotNumber ? { lotNumber } : {}),
      ...(type === StockMovementType.RECEIPT && expiryDate ? { expiryDate } : {}),
    })
  }

  parsedItems.sort((left, right) => left.productId.localeCompare(right.productId))
  return {
    idempotencyKey,
    supplierId: type === StockMovementType.RECEIPT ? supplierId as string : undefined,
    reference: typeof reference === 'string' ? reference.trim() || null : null,
    reason: type === StockMovementType.LOSS ? (reason as string).trim() : null,
    items: parsedItems,
  }
}

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export default router