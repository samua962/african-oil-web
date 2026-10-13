import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Clock3,
  Droplets,
  Package,
  Search,
  ShoppingCart,
} from 'lucide-react'
import { getDashboardSummary, type DashboardSummary } from './api/dashboard'
import { listProducts, productCategoryLabels, type Product, type ProductCategory } from './api/products'

const categoryFilters: (ProductCategory | 'ALL')[] = ['ALL', 'ENGINE_OIL', 'TRANSMISSION_FLUID', 'COOLANT', 'ACCESSORY', 'PACKAGED_GOOD']
const birr = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Dashboard() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'ALL'>('ALL')
  const [products, setProducts] = useState<Product[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  useEffect(() => {
    let active = true
    const loadSummary = async () => {
      try {
        const result = await getDashboardSummary()
        if (!active) return
        setSummary(result)
        setSummaryError('')
      } catch (cause) {
        if (active) setSummaryError(cause instanceof Error ? cause.message : 'Could not load sales report.')
      } finally {
        if (active) setSummaryLoading(false)
      }
    }
    void loadSummary()
    const interval = window.setInterval(loadSummary, 30000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true
    listProducts({ pageSize: 50 })
      .then((result) => {
        if (!active) return
        setProducts(result.products)
        setProductTotal(result.total)
        setProductsError('')
      })
      .catch((cause: unknown) => {
        if (active) setProductsError(cause instanceof Error ? cause.message : 'Could not load inventory.')
      })
      .finally(() => {
        if (active) setProductsLoading(false)
      })
    return () => { active = false }
  }, [])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory = category === 'ALL' || product.category === category
      const matchesQuery = !normalizedQuery || `${product.name} ${product.brand} ${product.sku}`.toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  const lowStockCount = summary?.lowStockCount ?? products.filter((product) => product.quantityOnHand <= product.reorderLevel).length
  const maxSalesCents = Math.max(1, ...(summary?.dailySales.map((day) => day.totalCents) ?? [0]))
  return (
    <main id="overview" className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
        <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-7 sm:px-7 lg:px-9 lg:pt-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2"><p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#728178]">Retail operations</p><span className="rounded border border-[#dce4d9] bg-[#edf2e9] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.7px] text-[#687b64]">Live report</span></div>
              <h1 className="text-[26px] font-bold leading-tight text-[#1c3028] sm:text-[30px]">Store overview</h1>
              <p className="mt-1.5 text-[12px] text-[#7d8982]">Daily performance and stock position at a glance.</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-[#e0e6df] bg-white px-3 py-2 text-[11px] text-[#66756b]"><Clock3 size={14} className="text-[#849188]" /><span>Today</span><span className="text-[#c5ccc6]">·</span><span>{new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium' }).format(new Date())}</span></div>
          </div>

          <section aria-label="Daily key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<CircleDollarSign size={18} />} label="Sales today" value={summaryLoading || summaryError ? '—' : birr.format((summary?.today.totalCents ?? 0) / 100)} suffix="ETB" note="Ethiopia time" accent="green" />
            <MetricCard icon={<ShoppingCart size={18} />} label="Transactions" value={summaryLoading || summaryError ? '—' : String(summary?.today.transactionCount ?? 0)} note="Sales recorded today" accent="blue" />
            <MetricCard icon={<Boxes size={18} />} label="Units sold" value={summaryLoading || summaryError ? '—' : String(summary?.today.unitsSold ?? 0)} note="Packaged items today" accent="amber" />
            <MetricCard icon={<AlertTriangle size={18} />} label="Low stock items" value={summaryLoading ? '—' : String(lowStockCount)} note="At or below reorder level" change={summaryLoading ? 'Loading' : lowStockCount > 0 ? 'Review stock' : 'All clear'} trend={lowStockCount > 0 ? 'alert' : undefined} accent={lowStockCount > 0 ? 'red' : 'green'} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
            <div id="sales" className="rounded-lg border border-[#e1e7df] bg-white p-5 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-semibold text-[#304138]">Sales performance</p><p className="mt-1 text-[11px] text-[#89958d]">Retail sales · last 7 days</p></div><span className="rounded border border-[#e4e9e3] px-2 py-1 text-[10px] text-[#748078]">ETB</span></div>
              <div className="mt-5 flex items-baseline gap-2"><span className="text-[24px] font-bold text-[#202638]">{summaryLoading || summaryError ? '—' : `ETB ${birr.format((summary?.sevenDaysTotalCents ?? 0) / 100)}`}</span>{summaryError && <span className="text-[10px] text-[#B82A1D]">Report unavailable</span>}</div>
              {summaryLoading ? <div className="mt-5 flex h-[144px] items-center justify-center text-[11px] text-[#89958d]">Loading sales report…</div> : summaryError ? <div role="alert" className="mt-5 flex h-[144px] items-center justify-center text-[11px] text-[#B82A1D]">{summaryError}</div> : (summary?.dailySales.every((day) => day.totalCents === 0) ?? true) ? <div className="mt-5 flex h-[144px] items-center justify-center text-[11px] text-[#89958d]">No sales recorded in the last 7 days.</div> : <div className="mt-5 grid h-[144px] grid-cols-7 items-end gap-2 border-b border-[#edf0ec] px-1 sm:gap-4">
                {summary?.dailySales.map((day, index) => <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2"><div className={`group relative w-full max-w-[34px] rounded-t-[3px] ${index === (summary?.dailySales.length ?? 0) - 1 ? 'bg-[#1B449C]' : 'bg-[#DCE5F6] hover:bg-[#BDCEEF]'}`} style={{ height: `${Math.max(8, (day.totalCents / maxSalesCents) * 100)}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#1B449C] px-1.5 py-0.5 text-[9px] text-white group-hover:block">{birr.format(day.totalCents / 100)}</span></div><span className={`pb-2 text-[10px] ${index === (summary?.dailySales.length ?? 0) - 1 ? 'font-semibold text-[#1B449C]' : 'text-[#98a1b0]'}`}>{day.label}</span></div>)}
              </div>}
            </div>

            <div id="stock-alerts" className="rounded-lg border border-[#e1e7df] bg-white p-5 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-[13px] font-semibold text-[#304138]">Reorder watch</p><p className="mt-1 text-[11px] text-[#89958d]">Items at or below minimum</p></div><span className="flex size-8 items-center justify-center rounded-md bg-[#FFF2DE] text-[#B56A00]"><AlertTriangle size={16} /></span></div>
              <div className="mt-4 divide-y divide-[#edf0ec]">{summaryLoading ? <p className="py-6 text-[11px] text-[#748078]">Checking stock levels…</p> : summaryError ? <p className="py-6 text-[11px] text-[#B82A1D]">Stock alerts unavailable.</p> : lowStockCount === 0 ? <p className="py-6 text-[11px] text-[#748078]">No products currently need replenishment.</p> : (summary?.lowStockProducts ?? products.filter((product) => product.quantityOnHand <= product.reorderLevel).slice(0, 5)).slice(0, 3).map((product) => <div key={product.id} className="flex items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#3c4b42]">{product.name}</p><p className="mt-0.5 text-[10px] text-[#929c95]">{product.brand ?? 'Unbranded'} · {product.packageSize ?? 'No pack size'}</p></div><div className="shrink-0 text-right"><p className="text-[11px] font-bold text-[#B82A1D]">{product.quantityOnHand} left</p><p className="text-[9px] text-[#929c95]">Min. {product.reorderLevel}</p></div></div>)}</div>
              <Link to="/inventory" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B449C]">View inventory <ArrowUpRight size={12} /></Link>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
            <div id="inventory" className="min-w-0 rounded-lg border border-[#e1e7df] bg-white shadow-[0_2px_6px_rgba(20,40,28,0.025)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ec] px-5 py-4 sm:px-6"><div><p className="text-[13px] font-semibold text-[#304138]">Inventory snapshot</p><p className="mt-1 text-[11px] text-[#89958d]">Current packaged retail stock</p></div><div className="relative w-full sm:w-[210px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59d]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or SKU" className="h-9 w-full rounded-md border border-[#e2e8e1] bg-[#fbfcfa] pl-9 pr-3 text-[11px] text-[#304138] outline-none placeholder:text-[#a2aca5] focus:border-[#7da790] focus:ring-2 focus:ring-[#e3efe6]" /></div></div>
              <div className="flex gap-1 overflow-x-auto border-b border-[#edf0ec] px-5 py-2.5 sm:px-6">{categoryFilters.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded px-2.5 py-1.5 text-[10px] font-medium ${category === item ? 'bg-[#EDF2FB] text-[#1B449C]' : 'text-[#758279] hover:bg-[#f3f5f2]'}`}>{item === 'ALL' ? 'All items' : productCategoryLabels[item]}</button>)}</div>
              {productsError ? <p role="alert" className="px-5 py-8 text-center text-[11px] text-[#B82A1D]">{productsError}</p> : productsLoading ? <p className="px-5 py-8 text-center text-[11px] text-[#89958d]">Loading products…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left"><thead><tr className="bg-[#fafbf9] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#929d95]"><th className="px-5 py-3 font-semibold sm:px-6">Product</th><th className="px-3 py-3 font-semibold">Category</th><th className="px-3 py-3 font-semibold">On hand</th><th className="px-3 py-3 font-semibold">Selling price</th></tr></thead>
                <tbody className="divide-y divide-[#f0f2ef]">{filteredProducts.map((product) => { const lowStock = product.quantityOnHand <= product.reorderLevel; return <tr key={product.id} className="hover:bg-[#fcfdfb]"><td className="px-5 py-3 sm:px-6"><p className="text-[11px] font-semibold text-[#394a40]">{product.name}</p><p className="mt-0.5 text-[9px] text-[#9aa49d]">{product.brand ?? 'Unbranded'} · {product.packageSize ?? 'No pack size'} · {product.sku}</p></td><td className="px-3 py-3 text-[10px] text-[#77847b]">{productCategoryLabels[product.category]}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${lowStock ? 'bg-[#B82A1D]' : 'bg-[#1B449C]'}`} /><span className={`text-[11px] font-semibold ${lowStock ? 'text-[#B82A1D]' : 'text-[#405247]'}`}>{product.quantityOnHand}</span><span className="text-[9px] text-[#a0aaa2]">/ {product.reorderLevel} min</span></div></td><td className="px-3 py-3 text-[10px] font-medium text-[#506056]">{birr.format(product.sellingCents / 100)} ETB</td></tr>})}{filteredProducts.length === 0 && <tr><td colSpan={4} className="px-6 py-9 text-center text-[11px] text-[#89958d]">No products match this search.</td></tr>}</tbody></table></div>}
              <div className="flex items-center justify-between border-t border-[#edf0ec] px-5 py-3 text-[10px] text-[#89958d] sm:px-6"><span>Showing {filteredProducts.length} of {productTotal} active products</span><Link to="/inventory" className="inline-flex items-center gap-1"><Package size={12} /> Manage catalog</Link></div>
            </div>

            <div className="rounded-lg border border-[#e1e7df] bg-white p-5 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-[13px] font-semibold text-[#304138]">Top sellers</p><p className="mt-1 text-[11px] text-[#89958d]">Units sold today</p></div><span className="flex size-8 items-center justify-center rounded-md bg-[#eaf1ed] text-[#36765c]"><Droplets size={16} /></span></div>
              {summaryLoading ? <p className="mt-5 text-[11px] text-[#89958d]">Loading product sales…</p> : summaryError ? <p className="mt-5 text-[11px] text-[#B82A1D]">{summaryError}</p> : summary?.topSellers.length ? <div className="mt-5 space-y-4">{summary.topSellers.map((product, index) => <div key={product.id}><div className="mb-1.5 flex items-center justify-between gap-2"><p className="truncate text-[10px] font-medium text-[#48584e]">{index + 1}. {product.name}</p><span className="shrink-0 text-[10px] font-bold text-[#526258]">{product.unitsSold}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf1ec]"><div className={`h-full rounded-full ${index === 0 ? 'bg-[#1B449C]' : 'bg-[#9CB1E0]'}`} style={{ width: `${(product.unitsSold / Math.max(1, summary.topSellers[0].unitsSold)) * 100}%` }} /></div></div>)}</div> : <p className="mt-5 text-[11px] text-[#89958d]">No sales recorded today.</p>}
              <div className="mt-5 border-t border-[#edf0ec] pt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#89958d]">Payment methods today</p>{summaryLoading ? <p className="text-[10px] text-[#89958d]">Loading payment totals…</p> : summaryError ? <p className="text-[10px] text-[#B82A1D]">Payment report unavailable.</p> : (Object.entries(summary?.today.paymentTotals ?? { CASH: 0, TELEBIRR: 0, CBE_BIRR: 0, CARD: 0 }) as [string, number][]).map(([method, cents]) => <div key={method} className="flex items-center justify-between py-1 text-[10px]"><span className="text-[#65736c]">{{ CASH: 'Cash', TELEBIRR: 'Telebirr', CBE_BIRR: 'CBE Birr', CARD: 'Card' }[method]}</span><span className="font-semibold text-[#34473d]">ETB {birr.format(cents / 100)}</span></div>)}</div>
            </div>
          </section>
          <div className="mt-5 flex justify-end px-1 text-[10px] text-[#98a39b]">Sales report refreshes every 30 seconds · Africa/Addis_Ababa</div>
        </div>
    </main>
  )
}

function MetricCard({ icon, label, value, suffix, note, change, trend, accent }: {
  icon: ReactNode
  label: string
  value: string
  suffix?: string
  note: string
  change?: string
  trend?: 'up' | 'down' | 'alert'
  accent: 'green' | 'blue' | 'amber' | 'red'
}) {
  const colors = { green: 'bg-[#EDF2FB] text-[#1B449C]', blue: 'bg-[#EDF2FB] text-[#1B449C]', amber: 'bg-[#FFF2DE] text-[#B56A00]', red: 'bg-[#FCEDEA] text-[#B82A1D]' }
  return <div className="rounded-lg border border-[#e1e7df] bg-white p-4 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium text-[#758279]">{label}</p><span className={`flex size-8 items-center justify-center rounded-md ${colors[accent]}`}>{icon}</span></div><div className="mt-4 flex items-baseline gap-1.5"><span className="text-[24px] font-bold text-[#23372e]">{value}</span>{suffix && <span className="text-[10px] font-medium text-[#839087]">{suffix}</span>}</div><div className="mt-2 flex min-h-4 items-center justify-between gap-2"><span className="truncate text-[10px] text-[#929d95]">{note}</span>{change && <span className={`inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold ${trend === 'alert' ? 'text-[#b15738]' : trend === 'down' ? 'text-[#b15738]' : 'text-[#39805f]'}`}>{trend === 'up' ? <ArrowUpRight size={11} /> : trend === 'down' ? <ArrowDownRight size={11} /> : trend === 'alert' ? <AlertTriangle size={10} /> : null}{change}</span>}</div></div>
}