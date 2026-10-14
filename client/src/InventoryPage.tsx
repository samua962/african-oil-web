import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, PackagePlus, Pencil, Plus, Search, X } from 'lucide-react'
import { useAuth } from './AuthContext'
import { createProduct, listProducts, productCategoryLabels, updateProduct, type Product, type ProductCategory, type ProductInput } from './api/products'
import { useLanguage } from './LanguageContext'

const categoryOptions = Object.entries(productCategoryLabels) as [ProductCategory, string][]
const birr = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const emptyForm = (): ProductInput => ({
  sku: '',
  barcode: '',
  name: '',
  brand: '',
  category: 'ENGINE_OIL',
  packageSize: '',
  costPrice: 0,
  sellingPrice: 0,
  reorderLevel: 5,
})

export default function InventoryPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const canManage = user?.role === 'ADMIN' || user?.role === 'STORE_MANAGER'
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState<ProductInput>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      void listProducts({ q: query, category, page, pageSize: 50 })
        .then((result) => {
          if (controller.signal.aborted) return
          setProducts(result.products)
          setTotal(result.total)
          setTotalPages(Math.max(result.totalPages, 1))
          setError('')
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load inventory.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [category, page, query, refreshVersion])

  const openCreate = () => {
    setEditingProduct(null)
    setIsCreating(true)
    setForm(emptyForm())
    setFormError('')
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setIsCreating(false)
    setForm({
      sku: product.sku,
      barcode: product.barcode ?? '',
      name: product.name,
      brand: product.brand ?? '',
      category: product.category,
      packageSize: product.packageSize ?? '',
      costPrice: (product.costCents ?? 0) / 100,
      sellingPrice: product.sellingCents / 100,
      reorderLevel: product.reorderLevel,
    })
    setFormError('')
  }

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      ...form,
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode?.trim() || null,
      name: form.name.trim(),
      brand: form.brand?.trim() || null,
      packageSize: form.packageSize?.trim() || null,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      reorderLevel: Number(form.reorderLevel),
    }

    try {
      if (editingProduct) await updateProduct(editingProduct.id, payload)
      else await createProduct(payload)
      setEditingProduct(null)
      setIsCreating(false)
      setLoading(true)
      const result = await listProducts({ q: query, category, page, pageSize: 50 })
      setProducts(result.products)
      setTotal(result.total)
      setTotalPages(Math.max(result.totalPages, 1))
      setError('')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save product.')
    } finally {
      setLoading(false)
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Store catalog')}</p>
            <h1 className="mt-1.5 text-[27px] font-bold text-[#202638]">{t('Inventory')}</h1>
            <p className="mt-1 text-[12px] text-[#7C8493]">{total} active packaged products</p>
          </div>
          {canManage && <button onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[12px] font-semibold text-white hover:bg-[#163981]"><Plus size={16} /> {t('Add product')}</button>}
        </div>

        <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#EDF0F5] px-4 py-4 sm:px-5">
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929BAC]" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={t('Search SKU, name, or brand')} className="h-10 w-full rounded-md border border-[#DDE2EC] pl-9 pr-3 text-[12px] outline-none focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]" />
            </div>
            <label className="relative">
              <span className="sr-only">Filter by category</span>
              <select value={category} onChange={(event) => { setCategory(event.target.value as ProductCategory | 'ALL'); setPage(1) }} className="h-10 min-w-[190px] appearance-none rounded-md border border-[#DDE2EC] bg-white pl-3 pr-9 text-[12px] text-[#3E485B] outline-none focus:border-[#1B449C]">
                <option value="ALL">{t('All categories')}</option>
                {categoryOptions.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7C8493]" />
            </label>
          </div>

          {error ? (
            <div className="px-5 py-12 text-center"><p className="text-[13px] font-semibold text-[#B82A1D]">Inventory couldn’t be loaded</p><p className="mt-2 text-[12px] text-[#7C8493]">{error}</p><button onClick={() => setRefreshVersion((current) => current + 1)} className="mt-4 text-[12px] font-semibold text-[#1B449C]">Try again</button></div>
          ) : loading ? (
            <div className="flex h-56 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" /> Loading inventory</div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center"><span className="flex size-11 items-center justify-center rounded-lg bg-[#EDF2FB] text-[#1B449C]"><PackagePlus size={21} /></span><p className="mt-3 text-[13px] font-semibold text-[#364156]">No products found</p><p className="mt-1 text-[11px] text-[#7C8493]">{query ? 'Try a different search or category.' : 'Add catalog details here, then record opening stock through stock receiving.'}</p>{canManage && !query && <button onClick={openCreate} className="mt-4 text-[12px] font-semibold text-[#1B449C]">Add first product</button>}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead><tr className="bg-[#F9FAFC] text-[10px] font-semibold uppercase tracking-[0.6px] text-[#8992A1]"><th className="px-5 py-3">{t('Product')}</th><th className="px-3 py-3">{t('Category')}</th>{canManage && <th className="px-3 py-3">{t('Cost')}</th>}<th className="px-3 py-3">{t('Selling price')}</th><th className="px-3 py-3">{t('On hand')}</th><th className="px-3 py-3">{t('Reorder at')}</th>{canManage && <th className="px-5 py-3 text-right">{t('Edit')}</th>}</tr></thead>
                <tbody className="divide-y divide-[#EDF0F5]">
                  {products.map((product) => {
                    const lowStock = product.quantityOnHand <= product.reorderLevel
                    return <tr key={product.id} className="hover:bg-[#FCFCFE]"><td className="px-5 py-3.5"><p className="text-[12px] font-semibold text-[#354055]">{product.name}</p><p className="mt-1 text-[10px] text-[#929BAC]">{product.brand || 'Unbranded'}{product.packageSize ? ` · ${product.packageSize}` : ''} · {product.sku}</p></td><td className="px-3 py-3.5 text-[11px] text-[#667187]">{productCategoryLabels[product.category]}</td>{canManage && <td className="px-3 py-3.5 text-[11px] text-[#667187]">{birr.format((product.costCents ?? 0) / 100)} ETB</td>}<td className="px-3 py-3.5 text-[11px] font-semibold text-[#354055]">{birr.format(product.sellingCents / 100)} ETB</td><td className="px-3 py-3.5"><span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${lowStock ? 'text-[#B82A1D]' : 'text-[#1B449C]'}`}><span className={`size-1.5 rounded-full ${lowStock ? 'bg-[#B82A1D]' : 'bg-[#1B449C]'}`} />{product.quantityOnHand}</span></td><td className="px-3 py-3.5 text-[11px] text-[#667187]">{product.reorderLevel}</td>{canManage && <td className="px-5 py-3.5 text-right"><button onClick={() => openEdit(product)} className="inline-flex size-8 items-center justify-center rounded-md text-[#1B449C] hover:bg-[#EDF2FB]" aria-label={`Edit ${product.name}`} title="Edit product"><Pencil size={15} /></button></td>}</tr>
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F5] px-4 py-3 text-[11px] text-[#828C9D] sm:px-5">
            <span>Showing {products.length ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} of {total}</span>
            <div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="flex size-8 items-center justify-center rounded-md border border-[#DDE2EC] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="flex size-8 items-center justify-center rounded-md border border-[#DDE2EC] disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button></div>
          </div>
        </section>
        <p className="mt-3 px-1 text-[10px] text-[#8C94A2]">On-hand quantity is changed through stock receipts and adjustments so every stock change remains auditable.</p>
      </div>

      {(isCreating || editingProduct !== null) && <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#172035]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditingProduct(null); setIsCreating(false); setFormError('') } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="product-form-title" className="text-[19px] font-bold text-[#202638]">{t(editingProduct ? 'Edit product' : 'Add product')}</h2><p className="mt-1 text-[11px] text-[#7C8493]">{t('Catalog details and ETB prices')}</p></div><button onClick={() => { setEditingProduct(null); setIsCreating(false); setFormError('') }} aria-label="Close" className="flex size-8 items-center justify-center rounded text-[#7C8493] hover:bg-[#F3F5F9]"><X size={17} /></button></div>
          <form onSubmit={saveProduct} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="SKU"><input required maxLength={40} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="OIL-TQ-001" /></FormField>
            <FormField label={t('Barcode (optional)')}><input maxLength={40} pattern="[A-Za-z0-9._\-]{4,40}" title="4-40 letters, numbers, dot, dash or underscore" value={form.barcode ?? ''} onChange={(event) => setForm({ ...form, barcode: event.target.value })} placeholder={t('Scan or type barcode')} /></FormField>
            <FormField label={t('Product name')}><input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t('Product name')} /></FormField>
            <FormField label={t('Brand')}><input maxLength={80} value={form.brand ?? ''} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Brand (optional)" /></FormField>
            <FormField label={t('Category')}><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })}>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></FormField>
            <FormField label={t('Package size')}><input maxLength={40} value={form.packageSize ?? ''} onChange={(event) => setForm({ ...form, packageSize: event.target.value })} placeholder="1 L, 4 L, 20 L" /></FormField>
            <FormField label={t('Reorder level')}><input required type="number" min="0" max="1000000" step="1" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: Number(event.target.value) })} /></FormField>
            <FormField label={t('Cost price (ETB)')}><input required type="number" min="0" max="10000000" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: Number(event.target.value) })} /></FormField>
            <FormField label={t('Selling price (ETB)')}><input required type="number" min="0" max="10000000" step="0.01" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: Number(event.target.value) })} /></FormField>
            {formError && formError !== '__CREATE__' && <p role="alert" className="rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3 py-2 text-[11px] text-[#A72419] sm:col-span-2">{formError}</p>}
            {!editingProduct && <p className="text-[11px] text-[#8C94A2] sm:col-span-2">New products start at zero stock. Receive opening stock as a separate audited stock-in entry.</p>}
            <div className="flex justify-end gap-2 border-t border-[#EDF0F5] pt-4 sm:col-span-2"><button type="button" onClick={() => { setEditingProduct(null); setIsCreating(false); setFormError('') }} className="h-9 rounded-md border border-[#DDE2EC] px-3 text-[11px] font-semibold text-[#58647A]">Cancel</button><button disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white hover:bg-[#163981] disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}{editingProduct ? 'Save changes' : 'Create product'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:text-[#202638] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[#DDE2EC] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:text-[#202638] [&_select]:outline-none">{children}</span></label>
}