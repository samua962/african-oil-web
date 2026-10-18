import cors from 'cors'
import express from 'express'
import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/auth.js'
import auditRoutes from './routes/audit.js'
import dashboardRoutes from './routes/dashboard.js'
import productRoutes from './routes/products.js'
import purchaseOrderRoutes from './routes/purchaseOrders.js'
import publicPreviewRoutes from './routes/publicPreview.js'
import reportRoutes from './routes/reports.js'
import saleRoutes from './routes/sales.js'
import shiftRoutes from './routes/shifts.js'
import stockMovementRoutes from './routes/stockMovements.js'
import supplierRoutes from './routes/suppliers.js'
import userRoutes from './routes/users.js'

// Separated from index.ts so tests can start the app on a random port.
export function createApp() {
  const app = express()
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }))
  app.use(express.json({ limit: '32kb' }))
  app.use(cookieParser())

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'fuel-retail-inventory-api' })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/products', productRoutes)
  app.use('/api/suppliers', supplierRoutes)
  app.use('/api/stock-movements', stockMovementRoutes)
  app.use('/api/sales', saleRoutes)
  app.use('/api/shifts', shiftRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/audit', auditRoutes)
  app.use('/api/reports', reportRoutes)
  app.use('/api/purchase-orders', purchaseOrderRoutes)
  app.use('/api/public', publicPreviewRoutes)

  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  const clientIndex = path.join(clientDist, 'index.html')
  if (fs.existsSync(clientIndex)) {
    app.use(express.static(clientDist))
    app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(clientIndex)
    })
  }

  return app
}
