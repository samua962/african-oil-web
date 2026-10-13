import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { Router } from 'express'
import { requireAuth, requireRole, type AuthenticatedUser } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { sendVerificationEmail } from '../lib/authTokens.js'
import { writeAudit } from '../lib/audit.js'

const router = Router()
const roles = Object.values(Role)
const userSelect = { id: true, name: true, username: true, email: true, emailVerifiedAt: true, role: true, active: true, createdAt: true } as const
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validEmail = (value: unknown) => typeof value === 'string' && value.length <= 200 && emailPattern.test(value.trim())

// Verification mail failures must not undo the account change; the admin can resend.
async function trySendVerification(user: { id: string; name: string; email: string | null }) {
  if (!user.email) return false
  try {
    await sendVerificationEmail(user, user.email)
    return true
  } catch (error) {
    console.error('Verification email failed', error)
    return false
  }
}

router.get('/', requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  })
  response.json({ users })
})

router.post('/:id/verification', requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: String(request.params.id) } })
  if (!user?.email || user.emailVerifiedAt) {
    response.status(409).json({ error: 'This user has no unverified email address.' })
    return
  }
  const sent = await trySendVerification(user)
  if (!sent) {
    response.status(502).json({ error: 'The verification email could not be sent. Check the mail settings.' })
    return
  }
  response.json({ message: 'Verification email sent.' })
})

router.post('/', requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const { name, username, password, role, email } = request.body ?? {}
  if (
    typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 ||
    typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/i.test(username.trim()) ||
    typeof password !== 'string' || password.length < 12 || password.length > 200 ||
    typeof role !== 'string' || !roles.includes(role as Role) ||
    (email !== undefined && email !== null && email !== '' && !validEmail(email))
  ) {
    response.status(400).json({ error: 'Provide a name, valid username, 12-character password, role, and a valid email if given.' })
    return
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
        passwordHash: await bcrypt.hash(password, 12),
        role: role as Role,
      },
      select: userSelect,
    })
    await trySendVerification(user)
    await writeAudit({ actorId: (response.locals.authUser as AuthenticatedUser).id, action: 'USER_CREATED', entity: 'User', entityId: user.id, details: { username: user.username, role: user.role }, request })
    response.status(201).json({ user })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'That username or email is already in use.' })
      return
    }
    throw error
  }
})

router.patch('/:id', requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const userId = request.params.id
  const actor = response.locals.authUser as AuthenticatedUser
  const { name, username, role, active, password, email } = request.body ?? {}

  if (typeof userId !== 'string') {
    response.status(400).json({ error: 'Invalid user ID.' })
    return
  }
  if (
    (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)) ||
    (username !== undefined && (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/i.test(username.trim()))) ||
    (role !== undefined && (typeof role !== 'string' || !roles.includes(role as Role))) ||
    (active !== undefined && typeof active !== 'boolean') ||
    (password !== undefined && (typeof password !== 'string' || password.length < 12 || password.length > 200)) ||
    (email !== undefined && email !== null && email !== '' && !validEmail(email)) ||
    (name === undefined && username === undefined && role === undefined && active === undefined && password === undefined && email === undefined)
  ) {
    response.status(400).json({ error: 'Provide valid account details, a role, active status, or a password of at least 12 characters.' })
    return
  }

  if (actor.id === userId && (active === false || (role !== undefined && role !== Role.ADMIN))) {
    response.status(409).json({ error: 'You cannot deactivate or change the role of your own account.' })
    return
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
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

      const nextEmail = email === undefined ? undefined : (typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null)
      const emailChanged = nextEmail !== undefined && nextEmail !== current.email

      const updated = await transaction.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined ? { name: (name as string).trim() } : {}),
          ...(username !== undefined ? { username: (username as string).trim().toLowerCase() } : {}),
          ...(role !== undefined ? { role: role as Role } : {}),
          ...(active !== undefined ? { active: active as boolean } : {}),
          // An admin password reset also signs the user out everywhere.
          ...(password !== undefined ? { passwordHash: await bcrypt.hash(password as string, 12), tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } : {}),
          // A new address must be re-verified before it can receive reset links.
          ...(emailChanged ? { email: nextEmail, emailVerifiedAt: null } : {}),
        },
        select: userSelect,
      })
      return { updated, emailChanged }
    }, { isolationLevel: 'Serializable' })

    if (!result) {
      response.status(404).json({ error: 'User not found.' })
      return
    }
    if (result.emailChanged) await trySendVerification(result.updated)
    await writeAudit({
      actorId: actor.id,
      action: password !== undefined ? 'USER_PASSWORD_RESET_BY_ADMIN' : 'USER_UPDATED',
      entity: 'User',
      entityId: userId,
      // Field names only; never log the password itself.
      details: { fields: Object.keys(request.body ?? {}).filter((key) => key !== 'password'), username: result.updated.username },
      request,
    })
    response.json({ user: result.updated })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'That username or email is already in use.' })
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