import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { getJwtSecret, requireAuth, sessionCookieName } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false
  if (!user || !user.active || !passwordMatches) {
    response.status(401).json({ error: 'Incorrect username or password.' })
    return
  }

  const token = jwt.sign({}, secret, { subject: user.id, expiresIn: '8h' })
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  })
  response.json({ user: { id: user.id, name: user.name, username: user.username, role: user.role } })
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
        ...(newPassword !== undefined ? { passwordHash: await bcrypt.hash(newPassword as string, 12) } : {}),
      },
      select: { id: true, name: true, username: true, role: true },
    })
    response.json({ user })
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