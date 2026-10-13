import { PaymentMethod, Prisma, Role, ShiftStatus } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const cashierRoles = [Role.CASHIER, Role.STORE_MANAGER, Role.ADMIN]
const managerRoles = [Role.STORE_MANAGER, Role.ADMIN]
const methods = Object.values(PaymentMethod)

class ShiftError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

router.get('/current', requireAuth, requireRole(...cashierRoles), async (_request, response) => {
  let shift = await prisma.shift.findFirst({
    where: { status: ShiftStatus.OPEN },
    orderBy: { openedAt: 'desc' },
    include: {
      openedBy: { select: { id: true, name: true } },
      sales: { where: { status: 'COMPLETED' }, include: { payment: true } },
      openingStocks: { include: { product: { select: { id: true, sku: true, name: true, packageSize: true, active: true } } } },
      movements: { select: { productId: true, quantityDelta: true } },
    },
  })

  if (shift && shift.openingStocks.length === 0) {
    await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { active: true },
        select: { id: true, quantityOnHand: true },
      })
      const movements = await transaction.stockMovement.groupBy({
        by: ['productId'],
        where: { shiftId: shift!.id },
        _sum: { quantityDelta: true },
      })
      const movementTotals = new Map(movements.map((movement) => [movement.productId, movement._sum.quantityDelta ?? 0]))
      if (products.length > 0) {
        await transaction.shiftOpeningStock.createMany({
          data: products.map((product) => ({
            shiftId: shift!.id,
            productId: product.id,
            openingQuantity: product.quantityOnHand - (movementTotals.get(product.id) ?? 0),
          })),
          skipDuplicates: true,
        })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    shift = await prisma.shift.findUnique({
      where: { id: shift.id },
      include: {
        openedBy: { select: { id: true, name: true } },
        sales: { where: { status: 'COMPLETED' }, include: { payment: true } },
        openingStocks: { include: { product: { select: { id: true, sku: true, name: true, packageSize: true, active: true } } } },
        movements: { select: { productId: true, quantityDelta: true } },
      },
    })
  }

  if (!shift) {
    response.json({ shift: null })
    return
  }

  response.json({ shift: summarizeShift(shift) })
})

router.get('/history', requireAuth, requireRole(...cashierRoles), async (request, response) => {
  const currentUser = response.locals.authUser
  const isManager = currentUser.role === Role.STORE_MANAGER || currentUser.role === Role.ADMIN
  const shifts = await prisma.shift.findMany({
    where: {
      status: ShiftStatus.CLOSED,
      ...(isManager ? {} : { openedById: currentUser.id }),
    },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      sales: { where: { status: 'COMPLETED' }, include: { payment: true } },
      reconciliations: { include: { product: { select: { sku: true, name: true } } } },
    },
    orderBy: { closedAt: 'desc' },
    take: 30,
  })
  response.json({ shifts: shifts.map(summarizeClosedShift) })
})

router.post('/open', requireAuth, requireRole(...cashierRoles), async (request, response) => {
  const openingFloatCents = parseEtb(request.body?.openingFloatEtb)
  if (openingFloatCents === null || openingFloatCents > 100_000_000) {
    response.status(400).json({ error: 'Opening cash must be a non-negative ETB amount no greater than 1,000,000.' })
    return
  }

  try {
    const openedById = response.locals.authUser.id as string
    const shift = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.shift.findFirst({ where: { status: ShiftStatus.OPEN }, select: { id: true } })
      if (existing) throw new ShiftError(409, 'A store shift is already open. Close it before opening another.')

      const activeProducts = await transaction.product.findMany({
        where: { active: true },
        select: { id: true, quantityOnHand: true },
        orderBy: { id: 'asc' },
      })
      const createdShift = await transaction.shift.create({ data: { openedById, openingFloatCents } })
      if (activeProducts.length > 0) {
        await transaction.shiftOpeningStock.createMany({
          data: activeProducts.map((product) => ({ shiftId: createdShift.id, productId: product.id, openingQuantity: product.quantityOnHand })),
        })
      }
      return transaction.shift.findUniqueOrThrow({
        where: { id: createdShift.id },
        include: { openedBy: { select: { id: true, name: true } }, sales: { where: { status: 'COMPLETED' }, include: { payment: true } }, openingStocks: { include: { product: { select: { id: true, sku: true, name: true, packageSize: true, active: true } } } }, movements: true },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    response.status(201).json({ shift: summarizeShift(shift) })
  } catch (error) {
    if (error instanceof ShiftError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (isPrismaError(error, 'P2034') || isPrismaError(error, 'P2002')) {
      response.status(409).json({ error: 'Another shift was opened at the same time. Refresh and try again.' })
      return
    }
    throw error
  }
})

router.post('/:id/close', requireAuth, requireRole(...cashierRoles), async (request, response) => {
  const shiftId = request.params.id
  if (typeof shiftId !== 'string' || !isUuid(shiftId)) {
    response.status(400).json({ error: 'Invalid shift ID.' })
    return
  }
  const cashCountedCents = parseEtb(request.body?.cashCountedEtb)
  const counts = parseCounts(request.body?.counts)
  if (cashCountedCents === null || counts === null) {
    response.status(400).json({ error: 'Enter a valid counted cash amount and a physical count for each product.' })
    return
  }

  const actor = response.locals.authUser
  const canCloseAny = managerRoles.includes(actor.role)
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const shift = await transaction.shift.findUnique({
        where: { id: shiftId },
        include: {
          sales: { where: { status: 'COMPLETED' }, include: { payment: true } },
          openingStocks: { include: { product: { select: { id: true, sku: true, name: true, packageSize: true, active: true } } } },
          movements: { select: { productId: true, quantityDelta: true } },
        },
      })
      if (!shift) throw new ShiftError(404, 'Shift not found.')
      if (shift.status !== ShiftStatus.OPEN) throw new ShiftError(409, 'This shift is already closed.')
      if (!canCloseAny && shift.openedById !== actor.id) throw new ShiftError(403, 'You can only close a shift you opened.')

      const currentProducts = await transaction.product.findMany({
        where: { active: true },
        select: { id: true, sku: true, name: true, packageSize: true },
        orderBy: { name: 'asc' },
      })
      const expectedByProduct = expectedQuantities(shift.openingStocks, shift.movements)
      const countMap = new Map(counts.map((line) => [line.productId, line.physicalQuantity]))
      if (countMap.size !== currentProducts.length || currentProducts.some((product) => !countMap.has(product.id))) {
        throw new ShiftError(400, 'Physical counts must include every active product exactly once. Refresh and recount.')
      }

      const reconciliations = currentProducts.map((product) => {
        const expectedQty = expectedByProduct.get(product.id) ?? 0
        const physicalQty = countMap.get(product.id)!
        return {
          shiftId: shift.id,
          productId: product.id,
          expectedQty,
          physicalQty,
          variance: physicalQty - expectedQty,
          recordedById: actor.id,
        }
      })
      if (reconciliations.length > 0) {
        await transaction.shiftReconciliation.createMany({ data: reconciliations })
      }

      const paymentTotals = sumPayments(shift.sales)
      const cashExpectedCents = shift.openingFloatCents + paymentTotals[PaymentMethod.CASH]
      const closedShift = await transaction.shift.update({
        where: { id: shift.id },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt: new Date(),
          closedById: actor.id,
          cashCountedCents,
          cashExpectedCents,
          cashVarianceCents: cashCountedCents - cashExpectedCents,
        },
      })
      const savedReconciliations = await transaction.shiftReconciliation.findMany({
        where: { shiftId: shift.id },
        include: { product: { select: { id: true, sku: true, name: true, packageSize: true } } },
        orderBy: { product: { name: 'asc' } },
      })
      return { shift: closedShift, paymentTotals, reconciliations: savedReconciliations }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    response.json({
      ...result,
      shift: {
        id: result.shift.id,
        cashCountedCents: result.shift.cashCountedCents,
        cashExpectedCents: result.shift.cashExpectedCents,
        cashVarianceCents: result.shift.cashVarianceCents,
      },
    })
  } catch (error) {
    if (error instanceof ShiftError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (isPrismaError(error, 'P2034')) {
      response.status(409).json({ error: 'The shift changed while closing. Refresh and try again.' })
      return
    }
    throw error
  }
})

function summarizeShift(shift: {
  id: string
  status: ShiftStatus
  openedAt: Date
  openingFloatCents: number
  openedBy: { id: string; name: string }
  sales: { totalCents: number; payment: { method: PaymentMethod; amountCents: number } | null }[]
  openingStocks: { productId: string; openingQuantity: number; product: { id: string; sku: string; name: string; packageSize: string | null; active: boolean } }[]
  movements: { productId: string; quantityDelta: number }[]
}) {
  const totals = sumPayments(shift.sales)
  return {
    id: shift.id,
    status: shift.status,
    openedAt: shift.openedAt,
    openingFloatCents: shift.openingFloatCents,
    openedBy: shift.openedBy,
    saleCount: shift.sales.length,
    salesTotalCents: shift.sales.reduce((total, sale) => total + sale.totalCents, 0),
    paymentTotals: totals,
    expectedCashCents: shift.openingFloatCents + totals[PaymentMethod.CASH],
    products: shift.openingStocks
      .filter((snapshot) => snapshot.product.active)
      .map((snapshot) => ({
        productId: snapshot.productId,
        sku: snapshot.product.sku,
        name: snapshot.product.name,
        packageSize: snapshot.product.packageSize,
        openingQuantity: snapshot.openingQuantity,
        expectedQuantity: snapshot.openingQuantity + shift.movements.filter((movement) => movement.productId === snapshot.productId).reduce((sum, movement) => sum + movement.quantityDelta, 0),
      })),
  }
}

function summarizeClosedShift(shift: {
  id: string
  openedAt: Date
  closedAt: Date | null
  openingFloatCents: number
  cashCountedCents: number | null
  cashExpectedCents: number | null
  cashVarianceCents: number | null
  openedBy: { id: string; name: string }
  closedBy: { id: string; name: string } | null
  sales: { totalCents: number; payment: { method: PaymentMethod; amountCents: number } | null }[]
  reconciliations: { expectedQty: number; physicalQty: number; variance: number; product: { sku: string; name: string } }[]
}) {
  return {
    id: shift.id,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    openedBy: shift.openedBy,
    closedBy: shift.closedBy,
    openingFloatCents: shift.openingFloatCents,
    cashCountedCents: shift.cashCountedCents,
    cashExpectedCents: shift.cashExpectedCents,
    cashVarianceCents: shift.cashVarianceCents,
    saleCount: shift.sales.length,
    salesTotalCents: shift.sales.reduce((total, sale) => total + sale.totalCents, 0),
    paymentTotals: sumPayments(shift.sales),
    varianceCount: shift.reconciliations.filter((item) => item.variance !== 0).length,
    reconciliations: shift.reconciliations,
  }
}

function sumPayments(sales: { payment: { method: PaymentMethod; amountCents: number } | null }[]) {
  const totals: Record<PaymentMethod, number> = {
    CASH: 0,
    TELEBIRR: 0,
    CBE_BIRR: 0,
    CARD: 0,
  }
  for (const sale of sales) {
    if (sale.payment) totals[sale.payment.method] += sale.payment.amountCents
  }
  return totals
}

function parseEtb(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) return null
  const cents = Math.round(value * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

function parseCounts(value: unknown): { productId: string; physicalQuantity: number }[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null
  const result: { productId: string; physicalQuantity: number }[] = []
  const seen = new Set<string>()
  for (const line of value) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return null
    const item = line as Record<string, unknown>
    if (typeof item.productId !== 'string' || !isUuid(item.productId) || seen.has(item.productId)) return null
    if (!Number.isInteger(item.physicalQuantity) || Number(item.physicalQuantity) < 0 || Number(item.physicalQuantity) > 1_000_000) return null
    seen.add(item.productId)
    result.push({ productId: item.productId, physicalQuantity: Number(item.physicalQuantity) })
  }
  return result
}

function expectedQuantities(
  openingStocks: { productId: string; openingQuantity: number }[],
  movements: { productId: string; quantityDelta: number }[],
) {
  const expected = new Map(openingStocks.map((snapshot) => [snapshot.productId, snapshot.openingQuantity]))
  for (const movement of movements) expected.set(movement.productId, (expected.get(movement.productId) ?? 0) + movement.quantityDelta)
  return expected
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export default router
