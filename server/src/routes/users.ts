import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole, type AuthenticatedUser } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const roles = Object.values(Role)

router.get('/', requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  response.json({ users })
})

router.post('/', requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const { name, username, password, role } = request.body ?? {}
  if (
    typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 ||
    typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/i.test(username.trim()) ||
    typeof password !== 'string' || password.length < 12 || password.length > 200 ||
    typeof role !== 'string' || !roles.includes(role as Role)
  ) {
    response.status(400).json({ error: 'Provide a name, valid username, 12-character password, and role.' })
    return
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(password, 8),
        role: role as Role,
      },
      select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
    })
    response.status(201).json({ user })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'That username is already in use.' })
      return
    }
    throw error
  }
})

router.patch('/:id', requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const userId = request.params.id
  const actor = response.locals.authUser as AuthenticatedUser
  const { name, username, role, active, password } = request.body ?? {}

  if (typeof userId !== 'string') {
    response.status(400).json({ error: 'Invalid user ID.' })
    return
  }
  if (
    (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)) ||
    (username !== undefined && (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/i.test(username.trim()))) ||
    (role !== undefined && (typeof role !== 'string' || !roles.includes(role as Role))) ||
    (active !== undefined && typeof active !== 'boolean') ||
    (password !== undefined && (typeof password !== 'string' || password.length < 8 || password.length > 200)) ||
    (name === undefined && username === undefined && role === undefined && active === undefined && password === undefined)
  ) {
    response.status(400).json({ error: 'Provide valid account details, a role, active status, or a password of at least 8 characters.' })
    return
  }

  if (actor.id === userId && (active === false || (role !== undefined && role !== Role.ADMIN))) {
    response.status(409).json({ error: 'You cannot deactivate or change the role of your own account.' })
    return
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({ where: { id: userId } })
      if (!current) return null

      const nextRole = (role as Role | undefined) ?? current.role
      const nextActive = (active as boolean | undefined) ?? current.active
      if (current.role === Role.ADMIN && current.active && (nextRole !== Role.ADMIN || !nextActive)) {
        const otherActiveAdmins = await transaction.user.count({
          where: { id: { not: current.id }, role: Role.ADMIN, active: true },
        })
        if (otherActiveAdmins === 0) throw new Error('LAST_ACTIVE_ADMIN')
      }

      return transaction.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined ? { name: (name as string).trim() } : {}),
          ...(username !== undefined ? { username: (username as string).trim().toLowerCase() } : {}),
          ...(role !== undefined ? { role: role as Role } : {}),
          ...(active !== undefined ? { active: active as boolean } : {}),
          ...(password !== undefined ? { passwordHash: await bcrypt.hash(password as string, 8) } : {}),
        },
        select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
      })
    }, { isolationLevel: 'Serializable' })

    if (!user) {
      response.status(404).json({ error: 'User not found.' })
      return
    }
    response.json({ user })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'That username is already in use.' })
      return
    }
    if (error instanceof Error && error.message === 'LAST_ACTIVE_ADMIN') {
      response.status(409).json({ error: 'At least one active administrator must remain.' })
      return
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      response.status(409).json({ error: 'Another user update happened at the same time. Refresh and try again.' })
      return
    }
    throw error
  }
})

export default router