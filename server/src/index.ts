import 'dotenv/config'
import { createApp } from './app.js'
import { prisma } from './lib/prisma.js'

const app = createApp()
const port = Number(process.env.PORT ?? 4000)

const server = app.listen(port, () => {
  console.log(`Inventory API listening on port ${port}`)
})

const shutdown = async () => {
  server.close()
  await prisma.$disconnect()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())