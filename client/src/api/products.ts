export type ProductCategory = 'ENGINE_OIL' | 'TRANSMISSION_FLUID' | 'COOLANT' | 'ACCESSORY' | 'PACKAGED_GOOD'

export type Product = {
  id: string
  sku: string
  barcode?: string | null
  name: string
  brand: string | null
  category: ProductCategory
  packageSize: string | null
  costCents?: number
  sellingCents: number
  quantityOnHand: number
  reorderLevel: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ProductInput = {
  sku: string
  barcode?: string | null
  name: string
  brand: string | null
  category: ProductCategory
  packageSize: string | null
  costPrice: number
  sellingPrice: number
  reorderLevel: number
}

type ProductListResponse = {
  products: Product[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type ErrorResponse = { error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const payload = await response.json().catch(() => ({})) as ErrorResponse & T
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}

export function listProducts(options: { q?: string; category?: ProductCategory | 'ALL'; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams()
  if (options.q) params.set('q', options.q)
  if (options.category) params.set('category', options.category)
  params.set('page', String(options.page ?? 1))
  params.set('pageSize', String(options.pageSize ?? 50))
  return request<ProductListResponse>(`/api/products?${params.toString()}`)
}

export async function createProduct(product: ProductInput) {
  return request<{ product: Product }>('/api/products', { method: 'POST', body: JSON.stringify(product) })
}

export async function updateProduct(id: string, product: ProductInput) {
  return request<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(product) })
}

export async function findProductByBarcode(code: string) {
  const result = await request<{ product: Product }>(`/api/products/barcode/${encodeURIComponent(code)}`)
  return result.product
}

export const productCategoryLabels: Record<ProductCategory, string> = {
  ENGINE_OIL: 'Engine oil',
  TRANSMISSION_FLUID: 'Transmission fluid',
  COOLANT: 'Coolant',
  ACCESSORY: 'Accessory',
  PACKAGED_GOOD: 'Packaged good',
}