import type { Role } from '@prisma/client'
import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

export type AuthenticatedUser = {
  id: string
  name: string
  username: string
  role: Role
}

export const sessionCookieName = 'inventory_session'

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET
  return secret && secret.length >= 32 ? secret : null
}

export const requireAuth: RequestHandler = async (_request, response, next) => {
  const secret = getJwtSecret()
  if (!secret) {
    response.status(503).json({ error: 'Authentication is not configured.' })
    return
  }

  const token = response.req.cookies?.[sessionCookieName] as string | undefined
  if (!token) {
    response.status(401).json({ error: 'Authentication required.' })
    return
  }

  try {
    const claims = jwt.verify(token, secret)
    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      response.status(401).json({ error: 'Invalid session.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, username: true, role: true, active: true, tokenVersion: true },
    })

    // A password reset bumps tokenVersion, revoking all older sessions.
    const claimVersion = typeof claims.tv === 'number' ? claims.tv : 0
    if (!user?.active || user.tokenVersion !== claimVersion) {
      response.clearCookie(sessionCookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
      response.status(401).json({ error: 'Authentication required.' })
      return
    }

    response.locals.authUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    } satisfies AuthenticatedUser
    next()
  } catch {
    response.clearCookie(sessionCookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    response.status(401).json({ error: 'Authentication required.' })
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authUser as AuthenticatedUser | undefined
    if (!user || !roles.includes(user.role)) {
      response.status(403).json({ error: 'You do not have permission to perform this action.' })
      return
    }
    next()
  }
}