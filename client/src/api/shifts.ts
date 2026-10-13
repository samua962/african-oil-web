import type { PaymentMethod } from './sales'

export type ShiftProduct = {
  productId: string
  sku: string
  name: string
  packageSize: string | null
  openingQuantity: number
  expectedQuantity: number
}

export type CurrentShift = {
  id: string
  status: 'OPEN'
  openedAt: string
  openingFloatCents: number
  openedBy: { id: string; name: string }
  saleCount: number
  salesTotalCents: number
  paymentTotals: Record<PaymentMethod, number>
  expectedCashCents: number
  products: ShiftProduct[]
}

export type ClosedShift = {
  id: string
  openedAt: string
  closedAt: string | null
  openedBy: { id: string; name: string }
  closedBy: { id: string; name: string } | null
  openingFloatCents: number
  cashCountedCents: number | null
  cashExpectedCents: number | null
  cashVarianceCents: number | null
  saleCount: number
  salesTotalCents: number
  paymentTotals: Record<PaymentMethod, number>
  varianceCount: number
  reconciliations: { expectedQty: number; physicalQty: number; variance: number; product: { sku: string; name: string } }[]
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

export async function getCurrentShift() {
  const result = await request<{ shift: CurrentShift | null }>('/api/shifts/current')
  return result.shift
}

export async function getShiftHistory() {
  const result = await request<{ shifts: ClosedShift[] }>('/api/shifts/history')
  return result.shifts
}

export async function openShift(openingFloatEtb: number) {
  const result = await request<{ shift: CurrentShift }>('/api/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ openingFloatEtb }),
  })
  return result.shift
}

export async function closeShift(shiftId: string, cashCountedEtb: number, counts: { productId: string; physicalQuantity: number }[]) {
  return request<{ shift: { id: string; cashCountedCents: number; cashExpectedCents: number; cashVarianceCents: number }; paymentTotals: Record<PaymentMethod, number>; reconciliations: { expectedQty: number; physicalQty: number; variance: number; product: { sku: string; name: string } }[] }>(`/api/shifts/${encodeURIComponent(shiftId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ cashCountedEtb, counts }),
  })
}
