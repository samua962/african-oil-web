import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { prisma } from '../lib/prisma.js'
import { createProduct, createUser, loggedIn, resetDatabase, startServer, type Client } from './helpers.js'

describe('sales, voids and shift reconciliation', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  let cashier: Client
  let manager: Client
  let productA: Awaited<ReturnType<typeof createProduct>>
  let productB: Awaited<ReturnType<typeof createProduct>>
  let shiftId: string
  let firstSaleId: string
  let lastSaleId: string
  let bSales = 0

  const sell = (client: Client, key: string, productId: string, quantity: number) =>
    client.request('POST', '/api/sales', { idempotencyKey: key, paymentMethod: 'CASH', items: [{ productId, quantity }] })
  const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).quantityOnHand

  before(async () => {
    await resetDatabase()
    server = await startServer()
    await createUser('CASHIER', 'cash1')
    await createUser('STORE_MANAGER', 'mgr1')
    productA = await createProduct('A-1', 10)
    productB = await createProduct('B-1', 3, { sellingCents: 2000 })
    cashier = await loggedIn(server.base, 'cash1')
    manager = await loggedIn(server.base, 'mgr1')
    const opened = await manager.request('POST', '/api/shifts/open', { openingFloatEtb: 100 })
    assert.equal(opened.status, 201)
    shiftId = opened.json.shift.id
  })
  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  it('hides cost price from cashiers', async () => {
    const response = await cashier.request('GET', '/api/products')
    assert.equal(response.status, 200)
    assert.equal('costCents' in response.json.products[0], false)
  })

  it('records a sale once even when the request is retried', async () => {
    const key = 'retry-key-0001'
    const first = await sell(cashier, key, productA.id, 2)
    assert.equal(first.status, 201)
    firstSaleId = first.json.sale.id
    const retry = await sell(cashier, key, productA.id, 2)
    assert.equal(retry.status, 200)
    assert.equal(retry.json.replayed, true)
    assert.equal(await stockOf(productA.id), 8)
    // Same key with a different basket is rejected.
    assert.equal((await sell(cashier, key, productA.id, 3)).status, 409)
  })

  it('never oversells under concurrent checkouts', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => sell(cashier, `race-key-${index}-0001`, productB.id, 1)))
    bSales = results.filter((result) => result.status === 201).length
    const stock = await stockOf(productB.id)
    assert.ok(bSales >= 1 && bSales <= 3, `expected 1-3 successful sales, got ${bSales}`)
    assert.equal(stock, 3 - bSales)
    assert.ok(stock >= 0)
  })

  it('lets only managers void a sale and restores stock exactly once', async () => {
    assert.equal((await cashier.request('POST', `/api/sales/${firstSaleId}/void`, { reason: 'Customer returned' })).status, 403)
    assert.equal((await manager.request('POST', `/api/sales/${firstSaleId}/void`, { reason: 'Customer returned' })).status, 200)
    assert.equal(await stockOf(productA.id), 10)
    assert.equal((await manager.request('POST', `/api/sales/${firstSaleId}/void`, { reason: 'Again' })).status, 409)
    assert.equal(await stockOf(productA.id), 10)
    const audit = await prisma.auditLog.count({ where: { action: 'SALE_VOIDED', entityId: firstSaleId } })
    assert.equal(audit, 1)
  })

  it('excludes voided sales from shift cash and reconciles with zero variance', async () => {
    const extra = await sell(cashier, 'final-sale-0001', productA.id, 1)
    assert.equal(extra.status, 201)
    lastSaleId = extra.json.sale.id

    const current = await manager.request('GET', '/api/shifts/current')
    assert.equal(current.json.shift.saleCount, bSales + 1)

    const expectedCents = 10_000 + bSales * 2000 + 5000
    assert.equal(current.json.shift.expectedCashCents, expectedCents)

    const closed = await manager.request('POST', `/api/shifts/${shiftId}/close`, {
      cashCountedEtb: expectedCents / 100,
      counts: [
        { productId: productA.id, physicalQuantity: await stockOf(productA.id) },
        { productId: productB.id, physicalQuantity: await stockOf(productB.id) },
      ],
    })
    assert.equal(closed.status, 200)
    assert.equal(closed.json.shift.cashVarianceCents, 0)
    assert.ok(closed.json.reconciliations.every((line: { variance: number }) => line.variance === 0))
  })

  it('refuses to void a sale from a closed shift', async () => {
    assert.equal((await manager.request('POST', `/api/sales/${lastSaleId}/void`, { reason: 'Too late' })).status, 409)
  })
})
