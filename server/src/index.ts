import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import saleRoutes from './routes/sales.js'
import stockMovementRoutes from './routes/stockMovements.js'
import supplierRoutes from './routes/suppliers.js'
import userRoutes from './routes/users.js'
import { prisma } from './lib/prisma.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'fuel-retail-inventory-api' })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/stock-movements', stockMovementRoutes)
app.use('/api/sales', saleRoutes)
app.use('/api/users', userRoutes)

const server = app.listen(port, () => {
  console.log(`Inventory API listening on port ${port}`)
})

const shutdown = async () => {
  server.close()
  await prisma.$disconnect()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())