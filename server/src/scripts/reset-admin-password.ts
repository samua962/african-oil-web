import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { prisma } from '../lib/prisma.js'

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD

if (!username || !password || password.length < 12) {
  console.error('Set ADMIN_USERNAME and a temporary ADMIN_PASSWORD of at least 12 characters in server/.env.')
  process.exitCode = 1
} else {
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      console.error('No user with that username exists.')
      process.exitCode = 1
    } else {
      // Bumping tokenVersion revokes any existing sessions.
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(password, 12), active: true, tokenVersion: { increment: 1 } },
      })
      console.log(`Password reset for ${username}. Sign in, then change it on the Profile page.`)
    }
  } finally {
    await prisma.$disconnect()
  }
}
