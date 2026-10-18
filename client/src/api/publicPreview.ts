import type { ProductCategory } from './products'

export type PublicPreview = {
  generatedAt: string
  stock: { category: ProductCategory; status: 'NO_PRODUCTS' | 'OUT_OF_STOCK' | 'REORDER' | 'AVAILABLE' }[]
  sales: { hasSalesToday: boolean; activeDaysThisWeek: number }
}

export async function getPublicPreview(): Promise<PublicPreview> {
  const response = await fetch('/api/public/preview', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({})) as PublicPreview & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Live preview is unavailable.')
  return payload
}
