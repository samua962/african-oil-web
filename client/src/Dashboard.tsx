import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Droplets,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Truck,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { useAuth } from './AuthContext'
import { listProducts, productCategoryLabels, type Product, type ProductCategory } from './api/products'

const weeklySales = [
  { day: 'Thu', amount: 18400 }, { day: 'Fri', amount: 23900 },
  { day: 'Sat', amount: 21200 }, { day: 'Sun', amount: 28700 },
  { day: 'Mon', amount: 19600 }, { day: 'Tue', amount: 31400 },
  { day: 'Wed', amount: 24850 },
]
const categoryFilters: (ProductCategory | 'ALL')[] = ['ALL', 'ENGINE_OIL', 'TRANSMISSION_FLUID', 'COOLANT', 'ACCESSORY', 'PACKAGED_GOOD']
const birr = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'ALL'>('ALL')
  const [products, setProducts] = useState<Product[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const updateConnection = () => setBrowserOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    let active = true

    const checkApi = async () => {
      if (!navigator.onLine) {
        if (active) setApiOnline(false)
        return
      }
      try {
        const response = await fetch('/api/health', { signal: AbortSignal.timeout(4000) })
        if (active) setApiOnline(response.ok)
      } catch {
        if (active) setApiOnline(false)
      }
    }

    void checkApi()
    const interval = window.setInterval(checkApi, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
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

  const lowStockCount = products.filter((product) => product.quantityOnHand <= product.reorderLevel).length
  const maxSales = Math.max(...weeklySales.map((day) => day.amount))
  const apiStatus = apiOnline === null ? 'Checking API' : apiOnline ? 'API connected' : 'API unavailable'

  return (
    <div className="min-h-screen bg-[#f4f6f2] text-[#172321]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-[#e1e7df] bg-[#fbfcfa] transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-[#e8ece6] px-4">
          <img src={africanOilLogo} alt="African Oil Ethiopia" className="h-auto w-[170px] object-contain" />
          <button className="ml-auto rounded-md p-1 text-[#718079] hover:bg-[#eef2ed] lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="px-4 pt-7">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[1px] text-[#98a39b]">Store</p>
          <a href="#overview" className="flex h-10 items-center gap-3 rounded-md bg-[#e9f2ec] px-3 text-[13px] font-semibold text-[#145442]"><LayoutDashboard size={17} /> Overview</a>
          <Link to="/sales" className="mt-1 flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#65736c] hover:bg-[#f0f3ef]"><ShoppingCart size={17} /> POS sales</Link>
          <Link to="/inventory" className="mt-1 flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#65736c] hover:bg-[#f0f3ef]"><Package size={17} /> Inventory <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[10px]">{productTotal}</span></Link>
          {user?.role !== 'CASHIER' && <Link to="/movements" className="mt-1 flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#65736c] hover:bg-[#f0f3ef]"><Truck size={17} /> Stock movements</Link>}
          {user?.role === 'ADMIN' && <Link to="/users" className="mt-1 flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#65736c] hover:bg-[#f0f3ef]"><UsersRound size={17} /> Users</Link>}
          <a href="#stock-alerts" className="mt-1 flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#65736c] hover:bg-[#f0f3ef]"><Truck size={17} /> Reorder watch <span className="ml-auto flex size-[19px] items-center justify-center rounded-full bg-[#fce8df] text-[10px] font-bold text-[#b34d2d]">{lowStockCount}</span></a>
        </div>
        <div className="mt-auto border-t border-[#e8ece6] p-4">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#1B449C]">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dce8df] text-[12px] font-bold text-[#285d4b]">{user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
              <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#304139]">{user?.name}</p><p className="text-[11px] text-[#829087]">My profile · {user?.role.replaceAll('_', ' ').toLowerCase()}</p></div>
            </Link>
            <button onClick={() => void logout()} title="Sign out" aria-label="Sign out" className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#69758A] hover:bg-[#FCEDEA] hover:text-[#B82A1D]"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {menuOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-20 bg-[#10221c]/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <main className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-10 flex h-[64px] items-center justify-between border-b border-[#e2e8e0] bg-[#fbfcfa]/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-2 text-[#52635a] hover:bg-[#eef2ed] lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <span className="text-[12px] text-[#8b9790]">Station 01</span><span className="text-[#c1c9c2]">/</span><span className="text-[12px] font-semibold text-[#34473d]">Overview</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className={`hidden items-center gap-1.5 text-[11px] font-medium sm:flex ${browserOnline && apiOnline ? 'text-[#34765c]' : 'text-[#a15439]'}`} title={apiStatus}>{browserOnline && apiOnline ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{apiStatus}</span></div>
            <div className="h-5 w-px bg-[#e0e6df]" /><span className="text-[11px] text-[#77847b]">ETB · Ethiopia</span>
          </div>
        </header>

        <div id="overview" className="mx-auto max-w-[1440px] px-4 pb-10 pt-7 sm:px-7 lg:px-9 lg:pt-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2"><p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#728178]">Retail operations</p><span className="rounded border border-[#dce4d9] bg-[#edf2e9] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.7px] text-[#687b64]">Demo data</span></div>
              <h1 className="text-[26px] font-bold leading-tight text-[#1c3028] sm:text-[30px]">Store overview</h1>
              <p className="mt-1.5 text-[12px] text-[#7d8982]">Daily performance and stock position at a glance.</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-[#e0e6df] bg-white px-3 py-2 text-[11px] text-[#66756b]"><Clock3 size={14} className="text-[#849188]" /><span>Today</span><span className="text-[#c5ccc6]">·</span><span>{new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium' }).format(new Date())}</span></div>
          </div>

          <section aria-label="Daily key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<CircleDollarSign size={18} />} label="Sales today" value="24,850.00" suffix="ETB" change="12.8%" note="vs. yesterday" trend="up" accent="green" />
            <MetricCard icon={<ShoppingCart size={18} />} label="Transactions" value="36" note="Across all payment types" change="4.2%" trend="up" accent="blue" />
            <MetricCard icon={<Boxes size={18} />} label="Units sold" value="52" note="Packaged retail items" change="3.1%" trend="down" accent="amber" />
            <MetricCard icon={<AlertTriangle size={18} />} label="Low stock items" value={String(lowStockCount)} note="At or below reorder level" change="Needs review" trend="alert" accent="red" />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
            <div id="sales" className="rounded-lg border border-[#e1e7df] bg-white p-5 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-semibold text-[#304138]">Sales performance</p><p className="mt-1 text-[11px] text-[#89958d]">Retail sales · past 7 days</p></div><div className="flex items-center gap-1.5 rounded border border-[#e4e9e3] px-2 py-1 text-[10px] text-[#748078]">This week <ChevronDown size={13} /></div></div>
              <div className="mt-5 flex items-baseline gap-2"><span className="text-[24px] font-bold text-[#25372f]">ETB 159,050</span><span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#39805f]"><ArrowUpRight size={13} /> 8.4%</span></div>
              <div className="mt-5 grid h-[144px] grid-cols-7 items-end gap-2 border-b border-[#edf0ec] px-1 sm:gap-4">
                {weeklySales.map((day, index) => <div key={day.day} className="flex h-full flex-col items-center justify-end gap-2"><div className={`group relative w-full max-w-[34px] rounded-t-[3px] ${index === weeklySales.length - 1 ? 'bg-[#26745c]' : 'bg-[#dce9df] hover:bg-[#b9d2c1]'}`} style={{ height: `${Math.max(12, (day.amount / maxSales) * 100)}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#213a30] px-1.5 py-0.5 text-[9px] text-white group-hover:block">{birr.format(day.amount)}</span></div><span className={`pb-2 text-[10px] ${index === weeklySales.length - 1 ? 'font-semibold text-[#28674f]' : 'text-[#98a39b]'}`}>{day.day}</span></div>)}
              </div>
            </div>

            <div id="stock-alerts" className="rounded-lg border border-[#e1e7df] bg-white p-5 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-[13px] font-semibold text-[#304138]">Reorder watch</p><p className="mt-1 text-[11px] text-[#89958d]">Items at or below minimum</p></div><span className="flex size-8 items-center justify-center rounded-md bg-[#fff0e8] text-[#bd5b39]"><AlertTriangle size={16} /></span></div>
              <div className="mt-4 divide-y divide-[#edf0ec]">{products.filter((product) => product.quantityOnHand <= product.reorderLevel).slice(0, 3).map((product) => <div key={product.id} className="flex items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#3c4b42]">{product.name}</p><p className="mt-0.5 text-[10px] text-[#929c95]">{product.brand ?? 'Unbranded'} · {product.packageSize ?? 'No pack size'}</p></div><div className="shrink-0 text-right"><p className="text-[11px] font-bold text-[#ac4d33]">{product.quantityOnHand} left</p><p className="text-[9px] text-[#929c95]">Min. {product.reorderLevel}</p></div></div>)}</div>
              <Link to="/inventory" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#27674f]">View inventory <ArrowUpRight size={12} /></Link>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
            <div id="inventory" className="min-w-0 rounded-lg border border-[#e1e7df] bg-white shadow-[0_2px_6px_rgba(20,40,28,0.025)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ec] px-5 py-4 sm:px-6"><div><p className="text-[13px] font-semibold text-[#304138]">Inventory snapshot</p><p className="mt-1 text-[11px] text-[#89958d]">Current packaged retail stock</p></div><div className="relative w-full sm:w-[210px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59d]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or SKU" className="h-9 w-full rounded-md border border-[#e2e8e1] bg-[#fbfcfa] pl-9 pr-3 text-[11px] text-[#304138] outline-none placeholder:text-[#a2aca5] focus:border-[#7da790] focus:ring-2 focus:ring-[#e3efe6]" /></div></div>
              <div className="flex gap-1 overflow-x-auto border-b border-[#edf0ec] px-5 py-2.5 sm:px-6">{categoryFilters.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded px-2.5 py-1.5 text-[10px] font-medium ${category === item ? 'bg-[#e8f1eb] text-[#26654f]' : 'text-[#758279] hover:bg-[#f3f5f2]'}`}>{item === 'ALL' ? 'All items' : productCategoryLabels[item]}</button>)}</div>
              {productsError ? <p role="alert" className="px-5 py-8 text-center text-[11px] text-[#B82A1D]">{productsError}</p> : productsLoading ? <p className="px-5 py-8 text-center text-[11px] text-[#89958d]">Loading products…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left"><thead><tr className="bg-[#fafbf9] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#929d95]"><th className="px-5 py-3 font-semibold sm:px-6">Product</th><th className="px-3 py-3 font-semibold">Category</th><th className="px-3 py-3 font-semibold">On hand</th><th className="px-3 py-3 font-semibold">Selling price</th></tr></thead>
                <tbody className="divide-y divide-[#f0f2ef]">{filteredProducts.map((product) => { const lowStock = product.quantityOnHand <= product.reorderLevel; return <tr key={product.id} className="hover:bg-[#fcfdfb]"><td className="px-5 py-3 sm:px-6"><p className="text-[11px] font-semibold text-[#394a40]">{product.name}</p><p className="mt-0.5 text-[9px] text-[#9aa49d]">{product.brand ?? 'Unbranded'} · {product.packageSize ?? 'No pack size'} · {product.sku}</p></td><td className="px-3 py-3 text-[10px] text-[#77847b]">{productCategoryLabels[product.category]}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${lowStock ? 'bg-[#c95c3c]' : 'bg-[#5e9a73]'}`} /><span className={`text-[11px] font-semibold ${lowStock ? 'text-[#ae4e34]' : 'text-[#405247]'}`}>{product.quantityOnHand}</span><span className="text-[9px] text-[#a0aaa2]">/ {product.reorderLevel} min</span></div></td><td className="px-3 py-3 text-[10px] font-medium text-[#506056]">{birr.format(product.sellingCents / 100)} ETB</td></tr>})}{filteredProducts.length === 0 && <tr><td colSpan={4} className="px-6 py-9 text-center text-[11px] text-[#89958d]">No products match this search.</td></tr>}</tbody></table></div>}
              <div className="flex items-center justify-between border-t border-[#edf0ec] px-5 py-3 text-[10px] text-[#89958d] sm:px-6"><span>Showing {filteredProducts.length} of {productTotal} active products</span><Link to="/inventory" className="inline-flex items-center gap-1"><Package size={12} /> Manage catalog</Link></div>
            </div>

            <div className="rounded-lg border border-[#e1e7df] bg-white p-5 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-[13px] font-semibold text-[#304138]">Catalog mix</p><p className="mt-1 text-[11px] text-[#89958d]">Active products by category</p></div><span className="flex size-8 items-center justify-center rounded-md bg-[#eaf1ed] text-[#36765c]"><Droplets size={16} /></span></div>
              <div className="mt-4 space-y-1">{(Object.entries(productCategoryLabels) as [ProductCategory, string][]).map(([key, label]) => { const count = products.filter((product) => product.category === key).length; return <div key={key} className="flex items-center justify-between border-b border-[#f0f2ef] py-2.5"><span className="text-[11px] text-[#65736c]">{label}</span><span className="text-[11px] font-semibold text-[#34473d]">{count}</span></div>})}</div>
              <div className="mt-4 flex items-center justify-between border-t border-[#edf0ec] pt-4 text-[10px] text-[#849087]"><span>{lowStockCount} items need reorder attention</span><span className="font-semibold text-[#34473d]">{productTotal} total</span></div>
            </div>
          </section>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-[#98a39b]"><span className="inline-flex items-center gap-1.5">{browserOnline ? <Wifi size={12} /> : <WifiOff size={12} />}{browserOnline ? 'Network available' : 'Offline · changes are not being synced'}</span><span>Sales figures are demo data. Inventory is live.</span></div>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ icon, label, value, suffix, note, change, trend, accent }: {
  icon: ReactNode
  label: string
  value: string
  suffix?: string
  note: string
  change: string
  trend: 'up' | 'down' | 'alert'
  accent: 'green' | 'blue' | 'amber' | 'red'
}) {
  const colors = { green: 'bg-[#e8f2eb] text-[#377456]', blue: 'bg-[#eaf0f4] text-[#52778d]', amber: 'bg-[#f6f0e4] text-[#967743]', red: 'bg-[#faece6] text-[#b6593a]' }
  return <div className="rounded-lg border border-[#e1e7df] bg-white p-4 shadow-[0_2px_6px_rgba(20,40,28,0.025)] sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium text-[#758279]">{label}</p><span className={`flex size-8 items-center justify-center rounded-md ${colors[accent]}`}>{icon}</span></div><div className="mt-4 flex items-baseline gap-1.5"><span className="text-[24px] font-bold text-[#23372e]">{value}</span>{suffix && <span className="text-[10px] font-medium text-[#839087]">{suffix}</span>}</div><div className="mt-2 flex min-h-4 items-center justify-between gap-2"><span className="truncate text-[10px] text-[#929d95]">{note}</span><span className={`inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold ${trend === 'alert' || trend === 'down' ? 'text-[#b15738]' : 'text-[#39805f]'}`}>{trend === 'up' ? <ArrowUpRight size={11} /> : trend === 'down' ? <ArrowDownRight size={11} /> : <AlertTriangle size={10} />}{change}</span></div></div>
}