export type SalesReport = {
  range: { from: string; to: string }
  totals: { salesCents: number; costCents: number; profitCents: number; transactions: number; units: number }
  byPayment: Record<string, number>
  byDay: { date: string; totalCents: number; transactions: number }[]
  byProduct: { sku: string; name: string; units: number; salesCents: number; costCents: number; profitCents: number }[]
}

export type ExpiryBatch = {
  id: string
  product: { id: string; sku: string; name: string; packageSize: string | null }
  lotNumber: string | null
  expiryDate: string
  quantityRemaining: number
  expired: boolean
}

export type ReorderSuggestion = {
  productId: string
  sku: string
  name: string
  packageSize: string | null
  quantityOnHand: number
  reorderLevel: number
  unitCostCents: number
  suggestedQuantity: number
  lastSupplier: { id: string; name: string } | null
}

export type PurchaseOrder = {
  id: string
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  notes: string | null
  createdAt: string
  orderedAt: string | null
  receivedAt: string | null
  supplier: { id: string; name: string }
  createdBy: { id: string; name: string }
  totalCents: number
  items: { id: string; quantity: number; unitCostCents: number; product: { id: string; sku: string; name: string; packageSize: string | null } }[]
}

export type AuditEntry = {
  id: string
  action: string
  entity: string
  entityId: string | null
  details: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  actor: { id: string; name: string; username: string } | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}

export const salesReportCsvUrl = (from: string, to: string, section: 'products' | 'days') =>
  `/api/reports/sales.csv?from=${from}&to=${to}&section=${section}`

export async function getSalesReport(from: string, to: string) {
  return (await request<{ report: SalesReport }>(`/api/reports/sales?from=${from}&to=${to}`)).report
}

export async function getExpiring(days: number) {
  return (await request<{ batches: ExpiryBatch[] }>(`/api/reports/expiry?days=${days}`)).batches
}

export async function getSuggestions() {
  return (await request<{ suggestions: ReorderSuggestion[] }>('/api/purchase-orders/suggestions')).suggestions
}

export async function listOrders() {
  return (await request<{ orders: PurchaseOrder[] }>('/api/purchase-orders')).orders
}

export function createOrder(supplierId: string, items: { productId: string; quantity: number; unitCostEtb: number }[]) {
  return request<{ order: PurchaseOrder }>('/api/purchase-orders', { method: 'POST', body: JSON.stringify({ supplierId, items }) })
}

export function setOrderStatus(id: string, status: 'ORDERED' | 'CANCELLED') {
  return request<{ ok: true }>(`/api/purchase-orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function receiveOrder(id: string) {
  return request<{ ok: true }>(`/api/purchase-orders/${encodeURIComponent(id)}/receive`, { method: 'POST' })
}

export function listAudit(page: number, entity: string) {
  const params = new URLSearchParams({ page: String(page) })
  if (entity) params.set('entity', entity)
  return request<{ logs: AuditEntry[]; page: number; totalPages: number; total: number }>(`/api/audit?${params.toString()}`)
}
