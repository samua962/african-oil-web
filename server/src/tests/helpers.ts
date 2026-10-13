import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'
import { createApp } from '../app.js'
import { prisma } from '../lib/prisma.js'

export const password = 'correct-horse-battery'

export async function startServer() {
  const server = createApp().listen(0)
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { base, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

// Refuses to wipe anything except the dedicated test schema.
export async function resetDatabase() {
  assert.ok(process.env.DATABASE_URL?.includes('schema=inventory_test'), 'Tests must run via npm test (isolated schema).')
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog","AuthToken","ProductBatch","PurchaseOrderItem","PurchaseOrder","StockMovement","StockMovementBatch","ShiftReconciliation","ShiftOpeningStock","Payment","SaleItem","Sale","Shift","Product","Supplier","User" CASCADE',
  )
}

export async function createUser(role: Role, username: string, extra: { email?: string; verified?: boolean } = {}) {
  return prisma.user.create({
    data: {
      name: `Test ${username}`,
      username,
      role,
      passwordHash: await bcrypt.hash(password, 4),
      ...(extra.email ? { email: extra.email, emailVerifiedAt: extra.verified ? new Date() : null } : {}),
    },
  })
}

export async function createProduct(sku: string, quantityOnHand: number, extra: { sellingCents?: number; name?: string; reorderLevel?: number; barcode?: string } = {}) {
  return prisma.product.create({
    data: {
      sku,
      name: extra.name ?? `Product ${sku}`,
      category: 'ENGINE_OIL',
      costCents: 3000,
      sellingCents: extra.sellingCents ?? 5000,
      quantityOnHand,
      reorderLevel: extra.reorderLevel ?? 0,
      barcode: extra.barcode,
    },
  })
}

export class Client {
  cookie = ''
  constructor(readonly base: string) {}

  async request(method: string, path: string, body?: unknown) {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* non-JSON body such as CSV */ }
    return { status: response.status, json, text }
  }

  async login(username: string, pass = password) {
    const response = await fetch(`${this.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pass }),
    })
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith('inventory_session='))
    if (response.status === 200 && cookie) this.cookie = cookie.split(';')[0]
    return response.status
  }
}

export async function loggedIn(base: string, username: string) {
  const client = new Client(base)
  assert.equal(await client.login(username), 200)
  return client
}
