import { Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const pageSize = 50
  const entity = typeof request.query.entity === 'string' && request.query.entity.length <= 40 ? request.query.entity : undefined
  const where = entity ? { entity } : {}
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])
  response.json({ logs, page, pageSize, total, totalPages: Math.ceil(total / pageSize) })
})

export default router
