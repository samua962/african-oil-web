import { ProductCategory, Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../lib/audit.js'

const router = Router()
const categories = Object.values(ProductCategory)
const editableRoles = [Role.STORE_MANAGER, Role.ADMIN]

function parsePrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000_000) return null
  const cents = Math.round(value * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

function productInput(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {}
  const required = (key: string) => !partial || key in body

  if (required('sku')) {
    if (typeof body.sku !== 'string' || body.sku.trim().length < 2 || body.sku.trim().length > 40) return null
    data.sku = body.sku.trim().toUpperCase()
  }
  if (required('name')) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) return null
    data.name = body.name.trim()
  }
  // Barcode is optional, so it is only validated when supplied.
  if ('barcode' in body) {
    if (body.barcode !== null && body.barcode !== '' && (typeof body.barcode !== 'string' || !/^[A-Za-z0-9._-]{4,40}$/.test(body.barcode.trim()))) return null
    data.barcode = typeof body.barcode === 'string' && body.barcode.trim() ? body.barcode.trim() : null
  }
  if (required('brand')) {
    if (body.brand !== null && (typeof body.brand !== 'string' || body.brand.trim().length > 80)) return null
    data.brand = typeof body.brand === 'string' ? body.brand.trim() || null : null
  }
  if (required('category')) {
    if (typeof body.category !== 'string' || !categories.includes(body.category as ProductCategory)) return null
    data.category = body.category as ProductCategory
  }
  if (required('packageSize')) {
    if (body.packageSize !== null && (typeof body.packageSize !== 'string' || body.packageSize.trim().length > 40)) return null
    data.packageSize = typeof body.packageSize === 'string' ? body.packageSize.trim() || null : null
  }
  for (const [key, field] of [['costPrice', 'costCents'], ['sellingPrice', 'sellingCents']] as const) {
    if (required(key)) {
      const cents = parsePrice(body[key])
      if (cents === null) return null
      data[field] = cents
    }
  }
  if (required('reorderLevel')) {
    if (!Number.isInteger(body.reorderLevel) || (body.reorderLevel as number) < 0 || (body.reorderLevel as number) > 1_000_000) return null
    data.reorderLevel = body.reorderLevel
  }

  return data
}

router.get('/', requireAuth, async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 80) : ''
  const category = typeof request.query.category === 'string' ? request.query.category : undefined
  if (category && category !== 'ALL' && !categories.includes(category as ProductCategory)) {
    response.status(400).json({ error: 'Invalid product category.' })
    return
  }

  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(request.query.pageSize ?? '50'), 10) || 50))
  const where = {
    active: true,
    ...(category && category !== 'ALL' ? { category: category as ProductCategory } : {}),
    ...(query ? {
      OR: [
        { sku: { contains: query, mode: 'insensitive' as const } },
        { barcode: { equals: query } },
        { name: { contains: query, mode: 'insensitive' as const } },
        { brand: { contains: query, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ])

  const canViewCost = response.locals.authUser.role !== Role.CASHIER
  const safeProducts = canViewCost
    ? products
    : products.map(({ costCents: _costCents, ...product }) => product)
  response.json({ products: safeProducts, page, pageSize, total, totalPages: Math.ceil(total / pageSize) })
})

router.get('/barcode/:code', requireAuth, async (request, response) => {
  const code = String(request.params.code).trim().slice(0, 40)
  const product = await prisma.product.findFirst({ where: { active: true, OR: [{ barcode: code }, { sku: code.toUpperCase() }] } })
  if (!product) {
    response.status(404).json({ error: 'No product matches that barcode.' })
    return
  }
  const { costCents, ...safe } = product
  response.json({ product: response.locals.authUser.role === Role.CASHIER ? safe : product })
})

router.post('/', requireAuth, requireRole(...editableRoles), async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    response.status(400).json({ error: 'Provide valid product details.' })
    return
  }
  const data = productInput(request.body as Record<string, unknown>, false)
  if (!data) {
    response.status(400).json({ error: 'Check the SKU, product details, category, prices, and reorder level.' })
    return
  }

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const created = await transaction.product.create({ data: data as never })
      const activeShift = await transaction.shift.findFirst({ where: { status: 'OPEN' }, select: { id: true } })
      if (activeShift) {
        await transaction.shiftOpeningStock.create({
          data: { shiftId: activeShift.id, productId: created.id, openingQuantity: 0 },
        })
      }
      return created
    })
    await writeAudit({ actorId: response.locals.authUser.id, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id, details: { sku: product.sku, name: product.name }, request })
    response.status(201).json({ product })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'A product with that SKU or barcode already exists.' })
      return
    }
    throw error
  }
})

router.patch('/:id', requireAuth, requireRole(...editableRoles), async (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    response.status(400).json({ error: 'Provide valid product details.' })
    return
  }
  const data = productInput(request.body as Record<string, unknown>, true)
  if (!data || Object.keys(data).length === 0) {
    response.status(400).json({ error: 'Provide at least one valid product field.' })
    return
  }
  const productId = request.params.id
  if (typeof productId !== 'string') {
    response.status(400).json({ error: 'Invalid product ID.' })
    return
  }

  try {
    const before = await prisma.product.findUnique({ where: { id: productId } })
    const product = await prisma.product.update({ where: { id: productId }, data: data as never })
    if (before) {
      // Record only the fields that actually changed.
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      for (const key of Object.keys(data) as (keyof typeof before)[]) {
        if (before[key] !== product[key]) changes[key] = { from: before[key], to: product[key] }
      }
      if (Object.keys(changes).length > 0) {
        await writeAudit({ actorId: response.locals.authUser.id, action: 'PRODUCT_UPDATED', entity: 'Product', entityId: product.id, details: { sku: product.sku, changes } as never, request })
      }
    }
    response.json({ product })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'A product with that SKU already exists.' })
      return
    }
    if (isRecordNotFoundError(error)) {
      response.status(404).json({ error: 'Product not found.' })
      return
    }
    throw error
  }
})

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function isRecordNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'
}

export default router