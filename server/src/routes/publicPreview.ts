import { ProductCategory } from '@prisma/client'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'

const router = Router()
const timezone = 'Africa/Addis_Ababa'
const categories = Object.values(ProductCategory)

router.get('/preview', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}), async (_request, response) => {
  const now = new Date()
  const today = dayKey(now)
  const firstDay = addDays(today, -6)
  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { category: true, quantityOnHand: true, reorderLevel: true },
    }),
    prisma.sale.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: midnight(firstDay), lt: midnight(addDays(today, 1)) },
      },
      select: { createdAt: true },
    }),
  ])

  const stock = categories.map((category) => {
    const categoryProducts = products.filter((product) => product.category === category)
    const hasStock = categoryProducts.some((product) => product.quantityOnHand > 0)
    const needsReorder = categoryProducts.some((product) => product.quantityOnHand <= product.reorderLevel)
    return {
      category,
      status: categoryProducts.length === 0 ? 'NO_PRODUCTS' : !hasStock ? 'OUT_OF_STOCK' : needsReorder ? 'REORDER' : 'AVAILABLE',
    }
  })

  const activeSalesDays = new Set(sales.map((sale) => dayKey(sale.createdAt)))
  response.setHeader('Cache-Control', 'public, max-age=60')
  response.json({
    generatedAt: now.toISOString(),
    stock,
    sales: {
      hasSalesToday: activeSalesDays.has(today),
      activeDaysThisWeek: activeSalesDays.size,
    },
  })
})

function dayKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(key: string, amount: number) {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function midnight(key: string) {
  return new Date(`${key}T00:00:00+03:00`)
}

export default router
