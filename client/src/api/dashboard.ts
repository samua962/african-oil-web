import type { PaymentMethod } from './sales'
import type { Product } from './products'

export type DashboardSummary = {
  timezone: string
  generatedAt: string
  today: {
    totalCents: number
    transactionCount: number
    unitsSold: number
    paymentTotals: Record<PaymentMethod, number>
  }
  sevenDaysTotalCents: number
  dailySales: { date: string; label: string; totalCents: number }[]
  topSellers: (Pick<Product, 'id' | 'sku' | 'name' | 'brand' | 'packageSize'> & { unitsSold: number; salesCents: number })[]
  lowStockCount: number
  lowStockProducts: Pick<Product, 'id' | 'sku' | 'name' | 'brand' | 'packageSize' | 'quantityOnHand' | 'reorderLevel'>[]
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch('/api/dashboard/summary', { credentials: 'same-origin' })
  const payload = await response.json().catch(() => ({})) as { summary?: DashboardSummary; error?: string }
  if (!response.ok || !payload.summary) throw new Error(payload.error ?? 'Could not load dashboard sales data.')
  return payload.summary
}
