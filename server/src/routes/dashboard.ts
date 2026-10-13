import { PaymentMethod, ProductCategory } from '@prisma/client'
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const timezone = 'Africa/Addis_Ababa'

router.get('/summary', requireAuth, async (_request, response) => {
  const now = new Date()
  const todayKey = dayKeyInEthiopia(now)
  const todayStart = ethiopianMidnight(todayKey)
  const tomorrowStart = ethiopianMidnight(addDays(todayKey, 1))
  const firstDayKey = addDays(todayKey, -6)
  const firstDayStart = ethiopianMidnight(firstDayKey)

  const [todaySales, paymentGroups, dailySalesRows, topProductGroups, unitsSoldToday, lowStockCountRows, lowStockProducts] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: todayStart, lt: tomorrowStart }, status: 'COMPLETED' },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { sale: { createdAt: { gte: todayStart, lt: tomorrowStart }, status: 'COMPLETED' } },
      _sum: { amountCents: true },
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: firstDayStart, lt: tomorrowStart }, status: 'COMPLETED' },
      select: { totalCents: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { createdAt: { gte: todayStart, lt: tomorrowStart }, status: 'COMPLETED' },
        product: { category: { in: [ProductCategory.ENGINE_OIL, ProductCategory.TRANSMISSION_FLUID, ProductCategory.COOLANT] } },
      },
      _sum: { quantity: true, lineTotalCents: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.saleItem.aggregate({
      where: { sale: { createdAt: { gte: todayStart, lt: tomorrowStart }, status: 'COMPLETED' } },
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Product" WHERE "active" = true AND "quantityOnHand" <= "reorderLevel"`,
    prisma.$queryRaw<{ id: string; sku: string; name: string; brand: string | null; packageSize: string | null; quantityOnHand: number; reorderLevel: number }[]>`SELECT id::text AS id, sku, name, brand, "packageSize", "quantityOnHand", "reorderLevel" FROM "Product" WHERE "active" = true AND "quantityOnHand" <= "reorderLevel" ORDER BY "quantityOnHand" ASC, name ASC LIMIT 5`,
  ])

  const paymentTotals: Record<PaymentMethod, number> = { CASH: 0, TELEBIRR: 0, CBE_BIRR: 0, CARD: 0 }
  for (const group of paymentGroups) paymentTotals[group.method] = group._sum.amountCents ?? 0

  const totalsByDay = new Map<string, number>()
  for (const sale of dailySalesRows) {
    const key = dayKeyInEthiopia(sale.createdAt)
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + sale.totalCents)
  }
  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(firstDayKey, index)
    return {
      date: key,
      label: new Intl.DateTimeFormat('en-ET', { weekday: 'short', timeZone: timezone }).format(ethiopianMidnight(key)),
      totalCents: totalsByDay.get(key) ?? 0,
    }
  })

  const topProductIds = topProductGroups.map((group) => group.productId)
  const products = topProductIds.length === 0 ? [] : await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, sku: true, name: true, brand: true, packageSize: true },
  })
  const productById = new Map(products.map((product) => [product.id, product]))
  const topSellers = topProductGroups.flatMap((group) => {
    const product = productById.get(group.productId)
    return product ? [{
      ...product,
      unitsSold: group._sum.quantity ?? 0,
      salesCents: group._sum.lineTotalCents ?? 0,
    }] : []
  })

  response.json({
    summary: {
      timezone,
      generatedAt: now.toISOString(),
      today: {
        totalCents: todaySales._sum.totalCents ?? 0,
        transactionCount: todaySales._count._all,
        unitsSold: unitsSoldToday._sum.quantity ?? 0,
        paymentTotals,
      },
      sevenDaysTotalCents: dailySales.reduce((sum, day) => sum + day.totalCents, 0),
      dailySales,
      topSellers,
      lowStockCount: lowStockCountRows[0]?.count ?? 0,
      lowStockProducts,
    },
  })
})

function dayKeyInEthiopia(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(dayKey: string, amount: number) {
  const [year, month, day] = dayKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function ethiopianMidnight(dayKey: string) {
  return new Date(`${dayKey}T00:00:00+03:00`)
}

export default router
