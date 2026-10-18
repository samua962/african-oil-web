import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { prisma } from '../lib/prisma.js'
import { Client, createProduct, createUser, loggedIn, resetDatabase, startServer, type Client as ClientType } from './helpers.js'

describe('purchasing, reports and barcodes', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  let manager: ClientType
  let admin: ClientType
  let cashier: ClientType
  let lowProduct: Awaited<ReturnType<typeof createProduct>>
  let supplierId: string

  before(async () => {
    await resetDatabase()
    server = await startServer()
    await createUser('ADMIN', 'adm1')
    await createUser('STORE_MANAGER', 'mgr2')
    await createUser('CASHIER', 'cash2')
    lowProduct = await createProduct('LOW-1', 2, { reorderLevel: 5, barcode: '6001234567890' })
    supplierId = (await prisma.supplier.create({ data: { name: 'Test Supplier' } })).id
    admin = await loggedIn(server.base, 'adm1')
    manager = await loggedIn(server.base, 'mgr2')
    cashier = await loggedIn(server.base, 'cash2')
  })
  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  it('suggests reorders for low-stock products', async () => {
    const response = await manager.request('GET', '/api/purchase-orders/suggestions')
    assert.equal(response.status, 200)
    const line = response.json.suggestions.find((item: { sku: string }) => item.sku === 'LOW-1')
    assert.ok(line && line.suggestedQuantity >= 1)
  })

  it('serves a public login preview without exposing product or sales details', async () => {
    const result = await new Client(server.base).request('GET', '/api/public/preview')
    assert.equal(result.status, 200)
    assert.ok(result.json.stock.some((item: { category: string }) => item.category === 'ENGINE_OIL'))
    assert.equal(typeof result.json.sales.hasSalesToday, 'boolean')
    assert.equal(typeof result.json.sales.activeDaysThisWeek, 'number')
    const serialized = JSON.stringify(result.json)
    assert.equal(serialized.includes('LOW-1'), false)
    assert.equal(serialized.includes('costCents'), false)
    assert.equal(serialized.includes('salesCents'), false)
  })

  it('receives a purchase order into stock only once', async () => {
    const created = await manager.request('POST', '/api/purchase-orders', { supplierId, items: [{ productId: lowProduct.id, quantity: 12, unitCostEtb: 30 }] })
    assert.equal(created.status, 201)
    const id = created.json.order.id

    // A draft cannot be received.
    assert.equal((await manager.request('POST', `/api/purchase-orders/${id}/receive`)).status, 409)
    assert.equal((await manager.request('PATCH', `/api/purchase-orders/${id}/status`, { status: 'ORDERED' })).status, 200)

    const results = await Promise.all([manager.request('POST', `/api/purchase-orders/${id}/receive`), manager.request('POST', `/api/purchase-orders/${id}/receive`)])
    assert.equal(results.filter((result) => result.status === 200).length, 1)
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: lowProduct.id } })).quantityOnHand, 14)
    assert.equal((await manager.request('POST', `/api/purchase-orders/${id}/receive`)).status, 409)
  })

  it('restricts purchasing and audit access by role', async () => {
    assert.equal((await cashier.request('GET', '/api/purchase-orders')).status, 403)
    assert.equal((await manager.request('GET', '/api/audit')).status, 403)
    const audit = await admin.request('GET', '/api/audit')
    assert.equal(audit.status, 200)
    assert.ok(audit.json.logs.some((log: { action: string }) => log.action === 'PURCHASE_ORDER_RECEIVED'))
  })

  it('finds a product by barcode', async () => {
    const found = await cashier.request('GET', '/api/products/barcode/6001234567890')
    assert.equal(found.status, 200)
    assert.equal(found.json.product.sku, 'LOW-1')
    assert.equal((await cashier.request('GET', '/api/products/barcode/0000000000')).status, 404)
  })

  it('neutralises spreadsheet formulas in CSV exports', async () => {
    const risky = await createProduct('RISK-1', 5, { name: '=SUM(1)' })
    assert.equal((await manager.request('POST', '/api/shifts/open', { openingFloatEtb: 0 })).status, 201)
    const sale = await cashier.request('POST', '/api/sales', { idempotencyKey: 'csv-sale-0001', paymentMethod: 'CASH', items: [{ productId: risky.id, quantity: 1 }] })
    assert.equal(sale.status, 201)
    const csv = await manager.request('GET', '/api/reports/sales.csv')
    assert.equal(csv.status, 200)
    assert.ok(csv.text.includes("'=SUM(1)"))
    assert.equal((await cashier.request('GET', '/api/reports/sales')).status, 403)
  })

  it('tracks lots and surfaces expiring stock', async () => {
    const received = await manager.request('POST', '/api/stock-movements/receipts', {
      idempotencyKey: 'receipt-key-000000001',
      supplierId,
      items: [{ productId: lowProduct.id, quantity: 4, lotNumber: 'LOT-7', expiryDate: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10) }],
    })
    assert.equal(received.status, 201)
    const expiry = await manager.request('GET', '/api/reports/expiry?days=30')
    assert.equal(expiry.status, 200)
    assert.ok(expiry.json.batches.some((batch: { lotNumber: string }) => batch.lotNumber === 'LOT-7'))
  })
})
