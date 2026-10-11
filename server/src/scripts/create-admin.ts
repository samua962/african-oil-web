import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

const name = process.env.ADMIN_NAME?.trim()
const username = process.env.ADMIN_USERNAME?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD

if (!name || !username || !password || password.length < 12) {
  console.error('Set ADMIN_NAME, ADMIN_USERNAME, and an ADMIN_PASSWORD of at least 12 characters in server/.env.')
  process.exitCode = 1
} else {
  try {
    const existingUser = await prisma.user.findUnique({ where: { username } })
    if (existingUser) {
      console.error('That username already exists. Choose another username or sign in with the existing account.')
      process.exitCode = 1
    } else {
      const passwordHash = await bcrypt.hash(password, 12)
      await prisma.user.create({ data: { name, username, passwordHash, role: Role.ADMIN } })
      console.log(`Admin account created for ${username}.`)
    }
  } finally {
    await prisma.$disconnect()
  }
}