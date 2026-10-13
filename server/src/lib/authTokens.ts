import { createHash, randomBytes } from 'node:crypto'
import type { AuthTokenPurpose } from '@prisma/client'
import { prisma } from './prisma.js'
import { sendMail } from './mailer.js'
import { renderEmail } from './emailTemplate.js'

const lifetimes: Record<AuthTokenPurpose, number> = {
  PASSWORD_RESET: 30 * 60 * 1000,
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

function appUrl() {
  return (process.env.APP_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
}

// Creates a single-use token (only its hash is stored) and invalidates older unused ones.
export async function issueToken(userId: string, purpose: AuthTokenPurpose, email: string) {
  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.authToken.create({
      data: { userId, purpose, email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + lifetimes[purpose]) },
    }),
  ])
  return token
}

export async function sendPasswordResetEmail(user: { id: string; name: string }, email: string) {
  const token = await issueToken(user.id, 'PASSWORD_RESET', email)
  const link = `${appUrl()}/reset-password?token=${token}`
  await sendMail({
    to: email,
    subject: 'Reset your password',
    text: `Hello ${user.name},\n\nUse this link to set a new password. It expires in 30 minutes and works once:\n${link}\n\nIf you did not request this, ignore this email.`,
    html: renderEmail({
      name: user.name,
      heading: 'Reset your password',
      intro: 'We received a request to reset your password. Use the button below to choose a new one.',
      buttonLabel: 'Set new password',
      link,
      note: 'This link expires in 30 minutes and can be used once.',
    }),
    devLink: link,
  })
}

// Security alert only; sent to verified addresses and never allowed to fail the request.
export async function notifyPasswordChanged(user: { name: string; email: string | null; emailVerifiedAt: Date | null }) {
  if (!user.email || !user.emailVerifiedAt) return
  try {
    await sendMail({
      to: user.email,
      subject: 'Your password was changed',
      text: `Hello ${user.name},\n\nYour password was just changed. If this was not you, contact your administrator immediately.`,
      html: renderEmail({
        name: user.name,
        heading: 'Your password was changed',
        intro: 'Your account password was just changed and all other devices were signed out.',
        note: 'If this was not you, contact your administrator immediately.',
      }),
    })
  } catch (error) {
    console.error('Password change alert failed', error)
  }
}

export async function sendVerificationEmail(user: { id: string; name: string }, email: string) {
  const token = await issueToken(user.id, 'EMAIL_VERIFICATION', email)
  const link = `${appUrl()}/verify-email?token=${token}`
  await sendMail({
    to: email,
    subject: 'Verify your email address',
    text: `Hello ${user.name},\n\nConfirm this email address so you can reset your password by email. The link expires in 24 hours:\n${link}`,
    html: renderEmail({
      name: user.name,
      heading: 'Verify your email address',
      intro: 'Confirm this email address so you can reset your password by email if you ever forget it.',
      buttonLabel: 'Verify email',
      link,
      note: 'This link expires in 24 hours.',
    }),
    devLink: link,
  })
}
