import { Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', requireAuth, async (_request, response) => {
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  })
  response.json({ suppliers })
})

router.post('/', requireAuth, requireRole(Role.STORE_MANAGER, Role.ADMIN), async (request, response) => {
  const { name, phone } = request.body ?? {}
  if (
    typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120 ||
    (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.trim().length > 40))
  ) {
    response.status(400).json({ error: 'Enter a supplier name and a valid optional phone number.' })
    return
  }

  const normalizedName = name.trim()
  const duplicate = await prisma.supplier.findFirst({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) {
    response.status(409).json({ error: 'A supplier with that name already exists.' })
    return
  }

  const supplier = await prisma.supplier.create({
    data: { name: normalizedName, phone: typeof phone === 'string' ? phone.trim() || null : null },
    select: { id: true, name: true, phone: true },
  })
  response.status(201).json({ supplier })
})

export default router