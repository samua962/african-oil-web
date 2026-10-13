import { createHash } from 'node:crypto'
import { PaymentMethod, Prisma, Role, StockMovementType } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../lib/audit.js'

const router = Router()
const saleRoles = [Role.CASHIER, Role.STORE_MANAGER, Role.ADMIN]
const managerRoles = [Role.STORE_MANAGER, Role.ADMIN]
const paymentMethods = Object.values(PaymentMethod)

class SaleError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

type SaleInput = {
  idempotencyKey: string
  paymentMethod: PaymentMethod
  items: { productId: string; quantity: number }[]
}

router.get('/', requireAuth, requireRole(...saleRoles), async (_request, response) => {
  const sales = await prisma.sale.findMany({
    include: {
      cashier: { select: { id: true, name: true, username: true } },
      items: { include: { product: { select: { id: true, sku: true, name: true } } } },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  response.json({ sales })
})

router.post('/', requireAuth, requireRole(...saleRoles), async (request, response) => {
  try {
    const parsed = parseInput(request.body)
    const currentUserId = response.locals.authUser.id as string
    const requestHash = createHash('sha256').update(JSON.stringify({
      paymentMethod: parsed.paymentMethod,
      items: [...parsed.items].sort((left, right) => left.productId.localeCompare(right.productId)),
    })).digest('hex')

    const result = await prisma.$transaction(async (transaction) => {
      const existingSale = await transaction.sale.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { items: { include: { product: { select: { id: true, sku: true, name: true } } } }, payment: true, cashier: { select: { id: true, name: true, username: true } } },
      })
      if (existingSale) {
        if (existingSale.requestHash !== requestHash || existingSale.cashierId !== currentUserId) {
          throw new SaleError(409, 'This retry key belongs to a different sale. Start a new checkout.')
        }
        return { sale: existingSale, replayed: true }
      }

      const activeShift = await transaction.shift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      })
      if (!activeShift) throw new SaleError(409, 'Open a shift before recording sales.')
      const shift = activeShift

      const productIds = parsed.items.map((item) => item.productId)
      const products = await transaction.product.findMany({
        where: { id: { in: productIds }, active: true },
        select: { id: true, name: true, sku: true, sellingCents: true, quantityOnHand: true },
      })
      if (products.length !== parsed.items.length) {
        throw new SaleError(404, 'One or more products are unavailable or inactive.')
      }

      const productMap = new Map(products.map((product) => [product.id, product]))
      const saleItems: { productId: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[] = []
      let totalCents = 0

      for (const item of parsed.items) {
        const product = productMap.get(item.productId)
        if (!product) {
          throw new SaleError(404, `Product ${item.productId} was not found.`)
        }
        if (product.quantityOnHand < item.quantity) {
          throw new SaleError(409, `Not enough stock for ${product.name} (${product.sku}). Available: ${product.quantityOnHand}.`)
        }
        const lineTotalCents = product.sellingCents * item.quantity
        totalCents += lineTotalCents
        saleItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: product.sellingCents,
          lineTotalCents,
        })
      }

      const sale = await transaction.sale.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          requestHash,
          shiftId: shift.id,
          cashierId: currentUserId,
          totalCents,
          items: {
            create: saleItems,
          },
          payment: {
            create: {
              method: parsed.paymentMethod,
              amountCents: totalCents,
              transactionReference: null,
            },
          },
        },
        include: {
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          payment: true,
          cashier: { select: { id: true, name: true, username: true } },
        },
      })

      for (const item of saleItems) {
        const stockUpdate = await transaction.product.updateMany({
          where: { id: item.productId, active: true, quantityOnHand: { gte: item.quantity } },
          data: { quantityOnHand: { decrement: item.quantity } },
        })
        if (stockUpdate.count !== 1) {
          const product = productMap.get(item.productId)!
          throw new SaleError(409, `Stock for ${product.name} changed during checkout. Refresh the sale and try again.`)
        }
        await transaction.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.SALE,
            quantityDelta: -item.quantity,
            reason: 'SALE',
            reference: sale.id,
            saleId: sale.id,
            createdById: currentUserId,
            shiftId: shift.id,
          },
        })
        await consumeBatches(transaction, item.productId, item.quantity)
      }

      return { sale, replayed: false }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    response.status(result.replayed ? 200 : 201).json({ sale: result.sale, replayed: result.replayed })
  } catch (error) {
    if (error instanceof SaleError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (isPrismaError(error, 'P2002')) {
      response.status(409).json({ error: 'A sale with this idempotency key already exists.' })
      return
    }
    if (isPrismaError(error, 'P2034')) {
      response.status(409).json({ error: 'Stock changed while the sale was being processed. Refresh and retry.' })
      return
    }
    throw error
  }
})

// Voiding restores stock and removes the sale from shift cash totals; only allowed while its shift is open.
router.post('/:id/void', requireAuth, requireRole(...managerRoles), async (request, response) => {
  const saleId = request.params.id
  const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : ''
  if (typeof saleId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleId) || reason.length < 3 || reason.length > 300) {
    response.status(400).json({ error: 'Provide a reason of 3 to 300 characters.' })
    return
  }

  const actorId = response.locals.authUser.id as string
  try {
    await prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findUnique({ where: { id: saleId }, include: { items: true, shift: { select: { status: true } } } })
      if (!sale) throw new SaleError(404, 'Sale not found.')
      if (sale.status === 'VOIDED') throw new SaleError(409, 'This sale is already voided.')
      if (sale.shift.status !== 'OPEN') throw new SaleError(409, 'This sale belongs to a closed shift. Record a stock adjustment instead.')

      await transaction.sale.update({ where: { id: sale.id }, data: { status: 'VOIDED', voidedAt: new Date(), voidedById: actorId, voidReason: reason } })
      for (const item of sale.items) {
        await transaction.product.update({ where: { id: item.productId }, data: { quantityOnHand: { increment: item.quantity } } })
        await transaction.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.REVERSAL,
            quantityDelta: item.quantity,
            reason: `VOID: ${reason}`,
            reference: sale.id,
            saleId: sale.id,
            createdById: actorId,
            shiftId: sale.shiftId,
          },
        })
      }
      await writeAudit({ actorId, action: 'SALE_VOIDED', entity: 'Sale', entityId: sale.id, details: { totalCents: sale.totalCents, reason }, request }, transaction)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    response.json({ ok: true })
  } catch (error) {
    if (error instanceof SaleError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (isPrismaError(error, 'P2034')) {
      response.status(409).json({ error: 'The sale changed while voiding. Refresh and try again.' })
      return
    }
    throw error
  }
})

// First-expired-first-out; batches are informational, so stock never fails because of them.
async function consumeBatches(transaction: Prisma.TransactionClient, productId: string, quantity: number) {
  const batches = await transaction.productBatch.findMany({
    where: { productId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
  })
  let remaining = quantity
  for (const batch of batches) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantityRemaining, remaining)
    await transaction.productBatch.update({ where: { id: batch.id }, data: { quantityRemaining: { decrement: take } } })
    remaining -= take
  }
}

function parseInput(body: unknown): SaleInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SaleError(400, 'Provide valid sale details.')
  }
  const input = body as Record<string, unknown>
  const { idempotencyKey, paymentMethod, items } = input
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    throw new SaleError(400, 'A valid sale key is required.')
  }
  if (typeof paymentMethod !== 'string' || !paymentMethods.includes(paymentMethod as PaymentMethod)) {
    throw new SaleError(400, 'Choose a valid payment method.')
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new SaleError(400, 'Add at least one product and no more than 20 lines.')
  }

  const parsedItems: SaleInput['items'] = []
  const seenProducts = new Set<string>()
  for (const line of items) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      throw new SaleError(400, 'Each product line must include a product and quantity.')
    }
    const item = line as Record<string, unknown>
    if (typeof item.productId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.productId)) {
      throw new SaleError(400, 'Select a valid product for each line.')
    }
    if (!Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 1000) {
      throw new SaleError(400, 'Quantities must be whole numbers between 1 and 1,000.')
    }
    if (seenProducts.has(item.productId)) {
      throw new SaleError(400, 'Products cannot be repeated in the same sale.')
    }
    seenProducts.add(item.productId)
    parsedItems.push({ productId: item.productId, quantity: Number(item.quantity) })
  }

  return { idempotencyKey, paymentMethod: paymentMethod as PaymentMethod, items: parsedItems }
}

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export default router
