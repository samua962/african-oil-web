import type { Product } from './products'

export type Supplier = { id: string; name: string; phone: string | null }
export type MovementType = 'RECEIPT' | 'LOSS'
export type MovementLineInput = { productId: string; quantity: number }
export type MovementInput = {
  idempotencyKey: string
  items: MovementLineInput[]
  reference?: string
  supplierId?: string
  reason?: string
}

export type StockMovement = {
  id: string
  type: MovementType
  quantityDelta: number
  reason: string | null
  reference: string | null
  createdAt: string
  product: Pick<Product, 'id' | 'sku' | 'name' | 'packageSize'>
  supplier: { id: string; name: string } | null
  createdBy: { id: string; name: string; username: string }
  batch: { id: string; reference: string | null; reason: string | null; createdAt: string }
}

export type MovementBatchResult = {
  batch: { id: string; type: MovementType; movements: StockMovement[] }
  replayed: boolean
}

type ApiPayload<T> = T & { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const payload = await response.json().catch(() => ({})) as ApiPayload<T>
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}

export async function listSuppliers() {
  const result = await request<{ suppliers: Supplier[] }>('/api/suppliers')
  return result.suppliers
}

export async function createSupplier(name: string, phone: string) {
  const result = await request<{ supplier: Supplier }>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify({ name, phone: phone || undefined }),
  })
  return result.supplier
}

export function listMovements(page = 1) {
  return request<{ movements: StockMovement[]; page: number; pageSize: number; total: number; totalPages: number }>(`/api/stock-movements?page=${page}&pageSize=50`)
}

export function createMovement(type: MovementType, movement: MovementInput) {
  const path = type === 'RECEIPT' ? '/api/stock-movements/receipts' : '/api/stock-movements/losses'
  return request<MovementBatchResult>(path, { method: 'POST', body: JSON.stringify(movement) })
}