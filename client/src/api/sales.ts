import type { Product } from './products'

export type PaymentMethod = 'CASH' | 'TELEBIRR' | 'CBE_BIRR' | 'CARD'

export type SaleLine = {
  productId: string
  quantity: number
}

export type SaleInput = {
  idempotencyKey: string
  paymentMethod: PaymentMethod
  items: SaleLine[]
}

export type Sale = {
  id: string
  idempotencyKey: string
  totalCents: number
  status: 'COMPLETED' | 'VOIDED'
  voidReason?: string | null
  createdAt: string
  cashier: { id: string; name: string; username: string }
  payment: { method: PaymentMethod; amountCents: number }
  items: {
    id: string
    quantity: number
    unitPriceCents: number
    lineTotalCents: number
    product: Pick<Product, 'id' | 'sku' | 'name'>
  }[]
}

type ApiResponse<T> = T & { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const payload = await response.json().catch(() => ({})) as ApiResponse<T>
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}

export async function createSale(data: SaleInput) {
  return request<{ sale: Sale; replayed: boolean }>('/api/sales', { method: 'POST', body: JSON.stringify(data) })
}

export async function listSales() {
  return request<{ sales: Sale[] }>('/api/sales')
}

export async function voidSale(id: string, reason: string) {
  return request<{ ok: true }>(`/api/sales/${encodeURIComponent(id)}/void`, { method: 'POST', body: JSON.stringify({ reason }) })
}
