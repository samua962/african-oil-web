import { Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const timezone = 'Africa/Addis_Ababa'
const maxRangeDays = 366

router.use(requireAuth, requireRole(Role.STORE_MANAGER, Role.ADMIN))

function dayKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const isDayKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

function addDays(key: string, amount: number) {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

// Cells starting with these characters can run as formulas in spreadsheet apps.
function csvCell(value: string | number) {
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const etb = (cents: number) => (cents / 100).toFixed(2)

async function buildSalesReport(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+03:00`)
  const end = new Date(`${addDays(to, 1)}T00:00:00+03:00`)
  const sales = await prisma.sale.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    select: {
      totalCents: true,
      createdAt: true,
      payment: { select: { method: true } },
      items: { select: { quantity: true, lineTotalCents: true, product: { select: { id: true, sku: true, name: true, costCents: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const byDay = new Map<string, { totalCents: number; transactions: number }>()
  const byPayment: Record<string, number> = { CASH: 0, TELEBIRR: 0, CBE_BIRR: 0, CARD: 0 }
  const byProduct = new Map<string, { sku: string; name: string; units: number; salesCents: number; costCents: number }>()
  let totalCents = 0
  let costCents = 0
  let units = 0

  for (const sale of sales) {
    const key = dayKey(sale.createdAt)
    const day = byDay.get(key) ?? { totalCents: 0, transactions: 0 }
    day.totalCents += sale.totalCents
    day.transactions += 1
    byDay.set(key, day)
    totalCents += sale.totalCents
    if (sale.payment) byPayment[sale.payment.method] += sale.totalCents
    for (const item of sale.items) {
      // Cost uses the product's current cost price; historical costs are not stored per sale.
      const lineCost = item.product.costCents * item.quantity
      costCents += lineCost
      units += item.quantity
      const row = byProduct.get(item.product.id) ?? { sku: item.product.sku, name: item.product.name, units: 0, salesCents: 0, costCents: 0 }
      row.units += item.quantity
      row.salesCents += item.lineTotalCents
      row.costCents += lineCost
      byProduct.set(item.product.id, row)
    }
  }

  const days: { date: string; totalCents: number; transactions: number }[] = []
  for (let key = from; key <= to; key = addDays(key, 1)) days.push({ date: key, ...(byDay.get(key) ?? { totalCents: 0, transactions: 0 }) })

  return {
    range: { from, to },
    totals: { salesCents: totalCents, costCents, profitCents: totalCents - costCents, transactions: sales.length, units },
    byPayment,
    byDay: days,
    byProduct: [...byProduct.values()]
      .map((row) => ({ ...row, profitCents: row.salesCents - row.costCents }))
      .sort((left, right) => right.salesCents - left.salesCents),
  }
}

function parseRange(query: Record<string, unknown>) {
  const today = dayKey(new Date())
  const to = isDayKey(query.to) ? query.to : today
  const from = isDayKey(query.from) ? query.from : addDays(to, -29)
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000
  if (from > to || spanDays > maxRangeDays) return null
  return { from, to }
}

router.get('/sales', async (request, response) => {
  const range = parseRange(request.query)
  if (!range) {
    response.status(400).json({ error: `Choose a valid date range of up to ${maxRangeDays} days.` })
    return
  }
  response.json({ report: await buildSalesReport(range.from, range.to) })
})

router.get('/sales.csv', async (request, response) => {
  const range = parseRange(request.query)
  if (!range) {
    response.status(400).json({ error: `Choose a valid date range of up to ${maxRangeDays} days.` })
    return
  }
  const report = await buildSalesReport(range.from, range.to)
  const days = request.query.section === 'days'
  const rows = days
    ? [['Date', 'Transactions', 'Sales (ETB)'], ...report.byDay.map((day) => [day.date, day.transactions, etb(day.totalCents)])]
    : [['SKU', 'Product', 'Units', 'Sales (ETB)', 'Cost (ETB)', 'Profit (ETB)'], ...report.byProduct.map((row) => [row.sku, row.name, row.units, etb(row.salesCents), etb(row.costCents), etb(row.profitCents)])]
  response.setHeader('Content-Type', 'text/csv; charset=utf-8')
  response.setHeader('Content-Disposition', `attachment; filename="${days ? 'daily-sales' : 'product-sales'}-${range.from}-to-${range.to}.csv"`)
  // BOM lets Excel read UTF-8 names correctly.
  response.send(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`)
})

router.get('/expiry', async (request, response) => {
  const days = Math.min(365, Math.max(1, Number.parseInt(String(request.query.days ?? '60'), 10) || 60))
  const limit = new Date(`${addDays(dayKey(new Date()), days)}T00:00:00Z`)
  const batches = await prisma.productBatch.findMany({
    where: { quantityRemaining: { gt: 0 }, expiryDate: { not: null, lte: limit } },
    include: { product: { select: { id: true, sku: true, name: true, packageSize: true } } },
    orderBy: { expiryDate: 'asc' },
    take: 200,
  })
  const today = dayKey(new Date())
  response.json({
    days,
    batches: batches.map((batch) => ({
      id: batch.id,
      product: batch.product,
      lotNumber: batch.lotNumber,
      expiryDate: batch.expiryDate!.toISOString().slice(0, 10),
      quantityRemaining: batch.quantityRemaining,
      expired: batch.expiryDate!.toISOString().slice(0, 10) < today,
    })),
  })
})

export default router
