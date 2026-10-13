import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { getJwtSecret, requireAuth, sessionCookieName } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { hashToken, notifyPasswordChanged, sendPasswordResetEmail } from '../lib/authTokens.js'
import { writeAudit } from '../lib/audit.js'

const maxFailedLogins = 5
const lockMinutes = 15

const router = Router()
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
})

router.post('/login', loginLimiter, async (request, response) => {
  const { username, password } = request.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 80 || password.length > 200) {
    response.status(400).json({ error: 'Enter a valid username and password.' })
    return
  }

  const secret = getJwtSecret()
  if (!secret) {
    response.status(503).json({ error: 'Authentication is not configured.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } })
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    response.status(429).json({ error: `Too many failed attempts. Try again in ${lockMinutes} minutes or ask your administrator.` })
    return
  }

  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false
  if (!user || !user.active || !passwordMatches) {
    if (user) {
      // Count atomically; lock the account once the limit is reached.
      const updated = await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } })
      if (updated.failedLoginCount >= maxFailedLogins) {
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + lockMinutes * 60 * 1000) } })
        await writeAudit({ actorId: user.id, action: 'LOGIN_LOCKED', entity: 'User', entityId: user.id, request })
      }
    }
    response.status(401).json({ error: 'Incorrect username or password.' })
    return
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } })
  }
  await writeAudit({ actorId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, request })

  const token = jwt.sign({ tv: user.tokenVersion }, secret, { subject: user.id, expiresIn: '8h' })
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  })
  response.json({ user: { id: user.id, name: user.name, username: user.username, role: user.role } })
})

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
})

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Always returns the same response so account existence is never revealed.
router.post('/forgot-password', recoveryLimiter, async (request, response) => {
  const { email } = request.body ?? {}
  if (typeof email !== 'string' || email.length > 200 || !emailPattern.test(email.trim())) {
    response.status(400).json({ error: 'Enter a valid email address.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (user?.active && user.emailVerifiedAt && user.email) {
    try {
      await sendPasswordResetEmail(user, user.email)
    } catch (error) {
      console.error('Password reset email failed', error)
    }
  }
  response.json({ message: 'If that email belongs to an active account, a reset link has been sent.' })
})

router.post('/reset-password', recoveryLimiter, async (request, response) => {
  const { token, password } = request.body ?? {}
  if (typeof token !== 'string' || token.length > 200 || typeof password !== 'string' || password.length < 12 || password.length > 200) {
    response.status(400).json({ error: 'Use a password of at least 12 characters.' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  let resetUser: { id: string; name: string; email: string | null; emailVerifiedAt: Date | null } | null = null
  const done = await prisma.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
    if (!record || record.purpose !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt < new Date() || !record.user.active) {
      return false
    }
    // Claim the token first so concurrent use cannot succeed twice.
    const claimed = await tx.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } })
    resetUser = record.user
    await writeAudit({ actorId: record.userId, action: 'PASSWORD_RESET', entity: 'User', entityId: record.userId, request }, tx)
    return true
  })

  if (!done) {
    response.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })
    return
  }
  response.json({ message: 'Password updated. You can sign in now.' })
  if (resetUser) void notifyPasswordChanged(resetUser)
})

router.post('/verify-email', recoveryLimiter, async (request, response) => {
  const { token } = request.body ?? {}
  if (typeof token !== 'string' || token.length > 200) {
    response.status(400).json({ error: 'This verification link is invalid or has expired.' })
    return
  }

  const done = await prisma.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
    // The token only verifies the address it was issued for.
    if (!record || record.purpose !== 'EMAIL_VERIFICATION' || record.usedAt || record.expiresAt < new Date() || record.email !== record.user.email) {
      return false
    }
    const claimed = await tx.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } })
    return true
  })

  if (!done) {
    response.status(400).json({ error: 'This verification link is invalid or has expired.' })
    return
  }
  response.json({ message: 'Email verified.' })
})

router.get('/me', requireAuth, (_request, response) => {
  response.json({ user: response.locals.authUser })
})

router.patch('/profile', requireAuth, async (request, response) => {
  const currentUser = response.locals.authUser
  const { name, username, currentPassword, newPassword } = request.body ?? {}
  if (
    (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)) ||
    (username !== undefined && (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/i.test(username.trim()))) ||
    ((currentPassword === undefined) !== (newPassword === undefined)) ||
    (currentPassword !== undefined && (typeof currentPassword !== 'string' || currentPassword.length > 200)) ||
    (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 200)) ||
    (name === undefined && username === undefined && newPassword === undefined)
  ) {
    response.status(400).json({ error: 'Check your name, username, and password fields.' })
    return
  }

  try {
    if (newPassword !== undefined) {
      const account = await prisma.user.findUnique({ where: { id: currentUser.id } })
      if (!account || !await bcrypt.compare(currentPassword as string, account.passwordHash)) {
        response.status(400).json({ error: 'Current password is incorrect.' })
        return
      }
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(name !== undefined ? { name: (name as string).trim() } : {}),
        ...(username !== undefined ? { username: (username as string).trim().toLowerCase() } : {}),
        ...(newPassword !== undefined ? { passwordHash: await bcrypt.hash(newPassword as string, 12), tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, name: true, username: true, role: true, email: true, emailVerifiedAt: true, tokenVersion: true },
    })

    if (newPassword !== undefined) {
      // Other devices are signed out; keep this one signed in with a fresh token.
      const secret = getJwtSecret()
      if (secret) {
        response.cookie(sessionCookieName, jwt.sign({ tv: user.tokenVersion }, secret, { subject: user.id, expiresIn: '8h' }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 8 * 60 * 60 * 1000,
        })
      }
      await writeAudit({ actorId: user.id, action: 'PASSWORD_CHANGED', entity: 'User', entityId: user.id, request })
      void notifyPasswordChanged(user)
    }
    response.json({ user: { id: user.id, name: user.name, username: user.username, role: user.role } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'That username is already in use.' })
      return
    }
    throw error
  }
})

router.post('/logout', (_request, response) => {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  response.sendStatus(204)
})

export default router