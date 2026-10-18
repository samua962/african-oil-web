import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Clock3,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import { getDashboardSummary, type DashboardSummary } from './api/dashboard'
import { listProducts, productCategoryLabels, type Product, type ProductCategory } from './api/products'

const categoryFilters: (ProductCategory | 'ALL')[] = ['ALL', 'ENGINE_OIL', 'TRANSMISSION_FLUID', 'COOLANT', 'ACCESSORY', 'PACKAGED_GOOD']
const birr = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ethiopiaDate = new Intl.DateTimeFormat('en-ET', { dateStyle: 'full', timeZone: 'Africa/Addis_Ababa' })

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'ALL'>('ALL')
  const [products, setProducts] = useState<Product[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [activeDay, setActiveDay] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    const loadSummary = async () => {
      try {
        const result = await getDashboardSummary()
        if (active) {
          setSummary(result)
          setSummaryError('')
        }
      } catch (cause) {
        if (active) setSummaryError(cause instanceof Error ? cause.message : 'Could not load sales report.')
      } finally {
        if (active) setSummaryLoading(false)
      }
    }
    void loadSummary()
    const timer = window.setInterval(loadSummary, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
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
    const text = query.trim().toLowerCase()
    return products.filter((product) => {
      const categoryMatch = category === 'ALL' || product.category === category
      const queryMatch = !text || `${product.name} ${product.brand ?? ''} ${product.sku}`.toLowerCase().includes(text)
      return categoryMatch && queryMatch
    })
  }, [category, products, query])

  const today = summary?.today
  const lowStockProducts = summary?.lowStockProducts ?? products.filter((product) => product.quantityOnHand <= product.reorderLevel)
  const weeklyDays = summary?.dailySales ?? []
  const peakDay = Math.max(1, ...weeklyDays.map((day) => day.totalCents))
  const previousDays = weeklyDays.slice(0, -1)
  const recentDailyAverage = previousDays.length
    ? previousDays.reduce((total, day) => total + day.totalCents, 0) / previousDays.length
    : 0
  const todayPace = recentDailyAverage > 0 ? Math.min((today?.totalCents ?? 0) / recentDailyAverage, 1) : 0
  const todayPct = Math.round(todayPace * 100)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Addis_Ababa' }).format(new Date()))
  const greeting = t(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const canManageStock = user?.role !== 'CASHIER'
  const paymentLabels: Record<string, string> = { CASH: 'Cash', TELEBIRR: 'Telebirr', CBE_BIRR: 'CBE Birr', CARD: 'Card' }
  const paymentColors: Record<string, string> = { CASH: '#E38505', TELEBIRR: '#1B449C', CBE_BIRR: '#B82A1D', CARD: '#28744C' }

  return (
    <main id="overview" className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] px-4 pb-10 pt-7 text-[#202638] sm:px-7 lg:px-9 lg:pt-9">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Operations')} <span className="text-[#929BAC]">/</span> {t('Station 01')}</p>
            <h1 className="text-[27px] font-bold leading-tight sm:text-[30px]">{greeting}{user?.name ? `, ${user.name}` : ''}</h1>
            <p className="mt-1.5 text-[12px] text-[#7C8493]">{ethiopiaDate.format(new Date())} · {t('Daily performance and stock position at a glance.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/sales" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#B82A1D] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#982319]"><Plus size={15} />{t('New sale')}</Link>
            {canManageStock && <Link to="/movements" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#DDE2EC] bg-white px-3.5 text-[11px] font-semibold text-[#354055] transition hover:bg-[#F2F5FA]"><Truck size={15} />{t('Receive stock')}</Link>}
            <Link to="/shifts" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#DDE2EC] bg-white px-3.5 text-[11px] font-semibold text-[#354055] transition hover:bg-[#F2F5FA]"><Clock3 size={15} />{t('Shift reconciliation')}</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-5 rounded-lg bg-[#101A2B] p-5 text-white shadow-[0_12px_32px_rgba(12,25,50,0.12)] sm:p-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr]">
          <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center xl:flex-col xl:items-start">
            <div className="relative grid size-[132px] shrink-0 place-items-center self-center sm:self-auto xl:self-start">
              <svg viewBox="0 0 132 132" className="absolute inset-0 size-full -rotate-90" role="img" aria-label={`${todayPct}% of recent daily average`}>
                <circle cx="66" cy="66" r="54" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="10" />
                <circle cx="66" cy="66" r="54" fill="none" stroke="#FFC83D" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${todayPace * 339.3} 339.3`} className="transition-[stroke-dasharray] duration-700" />
              </svg>
              <div className="text-center"><strong className="block text-[27px] font-bold">{summaryLoading ? '—' : `${todayPct}%`}</strong><span className="text-[9px] uppercase tracking-wide text-white/60">{t('of average')}</span></div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#FFC83D]">{t('Today so far')}</p>
              <p className="mt-1 text-[24px] font-bold">ETB {summaryLoading || summaryError ? '—' : birr.format((today?.totalCents ?? 0) / 100)}</p>
              <p className="mt-1 max-w-[34ch] text-[11px] leading-5 text-white/70">{recentDailyAverage > 0 ? `${t('Recent daily average')}: ETB ${birr.format(recentDailyAverage / 100)}` : t('No recent sales to compare yet.')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeroMetric icon={<CircleDollarSign size={17} />} label={t('Sales today')} value={summaryLoading || summaryError ? '—' : birr.format((today?.totalCents ?? 0) / 100)} suffix="ETB" />
            <HeroMetric icon={<ShoppingCart size={17} />} label={t('Transactions')} value={summaryLoading || summaryError ? '—' : String(today?.transactionCount ?? 0)} />
            <HeroMetric icon={<Boxes size={17} />} label={t('Units sold')} value={summaryLoading || summaryError ? '—' : String(today?.unitsSold ?? 0)} />
            <HeroMetric icon={<AlertTriangle size={17} />} label={t('Low stock items')} value={summaryLoading ? '—' : String(summary?.lowStockCount ?? products.filter((product) => product.quantityOnHand <= product.reorderLevel).length)} warning={(summary?.lowStockCount ?? 0) > 0} />
          </div>
        </section>

        {(summaryError || productsError) && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{summaryError || productsError}</p>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
          <div className="grid min-w-0 gap-4">
            <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-[15px] font-semibold">{t('Sales performance')}</h2><p className="mt-1 text-[11px] text-[#7C8493]">{t('Retail sales · last 7 days')}</p></div>
                <span className="rounded border border-[#E3E7EF] px-2 py-1 text-[10px] text-[#667187]">ETB</span>
              </div>
              <p className="mt-4 text-[22px] font-bold">ETB {summaryLoading || summaryError ? '—' : birr.format((summary?.sevenDaysTotalCents ?? 0) / 100)}</p>
              {summaryLoading ? <p className="mt-5 text-[11px] text-[#7C8493]">{t('Loading sales report…')}</p> : weeklyDays.length === 0 || weeklyDays.every((day) => day.totalCents === 0) ? (
                <p className="mt-5 flex h-36 items-center justify-center text-[11px] text-[#7C8493]">{t('No sales recorded in the last 7 days.')}</p>
              ) : <>
                <div className="mt-5 grid h-36 grid-cols-7 items-end gap-2 border-b border-[#E3E7EF] px-1 sm:gap-4">
                  {weeklyDays.map((day, index) => <button key={day.date} type="button" onFocus={() => setActiveDay(index)} onBlur={() => setActiveDay(null)} onMouseEnter={() => setActiveDay(index)} onMouseLeave={() => setActiveDay(null)} aria-label={`${day.date}: ETB ${birr.format(day.totalCents / 100)}`} className="group relative flex h-full min-w-0 flex-col items-center justify-end gap-2 bg-transparent p-0">
                    <span className={`${activeDay === index ? 'block' : 'hidden group-hover:block'} absolute -top-6 z-10 whitespace-nowrap rounded bg-[#101A2B] px-1.5 py-0.5 text-[9px] text-white`}>ETB {birr.format(day.totalCents / 100)}</span>
                    <span className="flex h-full w-full max-w-[42px] items-end"><i className={`block w-full rounded-t-sm transition-colors ${index === weeklyDays.length - 1 ? 'bg-[#B82A1D]' : 'bg-[#B9C9E7] group-hover:bg-[#738EBB]'}`} style={{ height: `${Math.max(5, (day.totalCents / peakDay) * 100)}%` }} /></span>
                    <span className={`pb-2 text-[9px] ${index === weeklyDays.length - 1 ? 'font-semibold text-[#B82A1D]' : 'text-[#7C8493]'}`}>{day.label}</span>
                  </button>)}
                </div>
              </>}
            </section>

            <section className="min-w-0 rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F5] px-5 py-4">
                <div><h2 className="text-[15px] font-semibold">{t('Inventory snapshot')}</h2><p className="mt-1 text-[11px] text-[#7C8493]">{t('Current packaged retail stock')}</p></div>
                <label className="relative w-full sm:w-[230px]"><span className="sr-only">{t('Search name or SKU')}</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8992A1]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search name or SKU')} className="h-9 w-full rounded-md border border-[#DDE2EC] bg-white pl-9 pr-3 text-[11px] text-[#354055] outline-none placeholder:text-[#8992A1] focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]" /></label>
              </div>
              <div className="flex gap-1 overflow-x-auto border-b border-[#EDF0F5] px-5 py-2.5">{categoryFilters.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded px-2.5 py-1.5 text-[10px] font-medium ${category === item ? 'bg-[#EDF2FB] text-[#1B449C]' : 'text-[#667187] hover:bg-[#F5F7FC]'}`}>{t(item === 'ALL' ? 'All items' : productCategoryLabels[item])}</button>)}</div>
              {productsLoading ? <p className="px-5 py-8 text-center text-[11px] text-[#7C8493]">{t('Loading products…')}</p> : productsError ? <p role="alert" className="px-5 py-8 text-center text-[11px] text-[#B82A1D]">{productsError}</p> : filteredProducts.length === 0 ? (
                <div className="px-5 py-8 text-center"><p className="text-[12px] font-semibold text-[#354055]">{products.length ? t('No products match this search.') : t('No products yet')}</p><p className="mt-1 text-[10px] text-[#7C8493]">{products.length ? t('Try another search or category.') : t('Add products in inventory, then receive stock.')}</p></div>
              ) : <div className="overflow-x-auto"><div className="min-w-[620px]">
                <div className="grid grid-cols-[minmax(180px,2fr)_130px_minmax(150px,1.5fr)_90px] gap-3 bg-[#F9FAFC] px-5 py-2.5 text-[9px] font-semibold uppercase tracking-wide text-[#8992A1]"><span>{t('Product')}</span><span>{t('Category')}</span><span>{t('On hand')}</span><span className="text-right">{t('Price')}</span></div>
                {filteredProducts.slice(0, 8).map((product) => {
                  const status = product.quantityOnHand <= 0 ? 'OUT_OF_STOCK' : product.quantityOnHand <= product.reorderLevel ? 'LOW' : 'OK'
                  const gauge = Math.min(product.quantityOnHand / Math.max(product.reorderLevel * 2, 1), 1) * 100
                  return <div key={product.id} className="grid grid-cols-[minmax(180px,2fr)_130px_minmax(150px,1.5fr)_90px] items-center gap-3 border-t border-[#EDF0F5] px-5 py-3 text-[10px] hover:bg-[#FCFCFE]">
                    <div className="min-w-0"><p className="truncate font-semibold text-[#354055]">{product.name}</p><p className="mt-0.5 truncate text-[9px] text-[#8992A1]">{product.brand ?? 'Unbranded'}{product.packageSize ? ` · ${product.packageSize}` : ''} · {product.sku}</p></div>
                    <span className="truncate text-[#667187]">{t(productCategoryLabels[product.category])}</span>
                    <div className="flex items-center gap-2"><span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-[#E8ECF2]"><i className={`block h-full rounded-full ${status === 'OUT_OF_STOCK' ? 'bg-[#B82A1D]' : status === 'LOW' ? 'bg-[#E38505]' : 'bg-[#1B449C]'}`} style={{ width: `${gauge}%` }} /></span><b className={status === 'OK' ? 'text-[#354055]' : 'text-[#B82A1D]'}>{product.quantityOnHand}</b><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-bold ${status === 'OK' ? 'bg-[#EDF2FB] text-[#1B449C]' : 'bg-[#FCF0EE] text-[#B82A1D]'}`}>{t(status)}</span></div>
                    <span className="text-right font-semibold text-[#354055]">{birr.format(product.sellingCents / 100)}</span>
                  </div>
                })}
              </div></div>}
              <div className="flex items-center justify-between gap-3 border-t border-[#EDF0F5] px-5 py-3 text-[10px] text-[#7C8493]"><span>{t('Showing')} {Math.min(filteredProducts.length, 8)} {t('of')} {productTotal} {t('active products')}</span><Link to="/inventory" className="font-semibold text-[#1B449C] hover:underline">{t('Manage catalog')} →</Link></div>
            </section>
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
              <div className="mb-3 flex items-start justify-between"><div><h2 className="text-[14px] font-semibold">{t('Reorder watch')}</h2><p className="mt-1 text-[10px] text-[#7C8493]">{t('Items at or below minimum')}</p></div><span className={`grid size-8 place-items-center rounded-md ${lowStockProducts.length ? 'bg-[#FFF2DE] text-[#B56A00]' : 'bg-[#EDF2FB] text-[#1B449C]'}`}><AlertTriangle size={15} /></span></div>
              {summaryLoading ? <p className="py-5 text-[11px] text-[#7C8493]">{t('Checking stock levels…')}</p> : lowStockProducts.length === 0 ? <div className="py-5"><p className="text-[12px] font-semibold text-[#354055]">{t('All stocked up')}</p><p className="mt-1 text-[10px] text-[#7C8493]">{t('Nothing is at or below its minimum.')}</p></div> : <ul className="divide-y divide-[#EDF0F5]">{lowStockProducts.slice(0, 5).map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-[#354055]">{product.name}</p><p className="mt-0.5 text-[9px] text-[#8992A1]">{product.packageSize ?? product.sku}</p></div><div className="shrink-0 text-right"><p className="text-[10px] font-bold text-[#B82A1D]">{product.quantityOnHand === 0 ? t('Out of stock') : t('Low stock')}</p><p className="text-[9px] text-[#8992A1]">{product.quantityOnHand} / {product.reorderLevel} {t('min')}</p></div></li>)}</ul>}
              <Link to={canManageStock ? '/purchasing' : '/inventory'} className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B449C]">{t(canManageStock ? 'Create a reorder' : 'View inventory')} <ArrowUpRight size={12} /></Link>
            </section>

            <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[14px] font-semibold">{t('Top sellers')}</h2><p className="mt-1 text-[10px] text-[#7C8493]">{t('Units sold today')}</p></div><span className="grid size-8 place-items-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><Activity size={15} /></span></div>
              {summaryLoading ? <p className="py-4 text-[11px] text-[#7C8493]">{t('Loading product sales…')}</p> : summary?.topSellers.length ? <ol className="space-y-3">{summary.topSellers.slice(0, 5).map((seller, index) => <li key={seller.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-[#101A2B] text-[9px] font-bold text-[#FFC83D]">{index + 1}</span><div className="min-w-0"><p className="truncate text-[10px] font-medium text-[#354055]">{seller.name}</p><span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#E8ECF2]"><i className="block h-full rounded-full bg-[#1B449C]" style={{ width: `${(seller.unitsSold / Math.max(1, summary.topSellers[0].unitsSold)) * 100}%` }} /></span></div><b className="text-[10px] text-[#354055]">{seller.unitsSold}</b></li>)}</ol> : <p className="py-4 text-[11px] text-[#7C8493]">{t('No sales recorded today.')}</p>}
            </section>

            <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
              <div className="mb-3 flex items-start justify-between"><div><h2 className="text-[14px] font-semibold">{t('Payment methods today')}</h2><p className="mt-1 text-[10px] text-[#7C8493]">ETB {birr.format(Object.values(today?.paymentTotals ?? {}).reduce((sum, value) => sum + value, 0) / 100)} {t('collected')}</p></div><span className="grid size-8 place-items-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><Activity size={15} /></span></div>
              <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-[#E8ECF2]">{Object.entries(today?.paymentTotals ?? {}).filter(([, amount]) => amount > 0).map(([method, amount]) => <i key={method} style={{ flex: amount, background: paymentColors[method] }} />)}</div>
              <ul className="space-y-2">{Object.entries(today?.paymentTotals ?? { CASH: 0, TELEBIRR: 0, CBE_BIRR: 0, CARD: 0 }).map(([method, amount]) => <li key={method} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-[10px]"><span className="size-2 rounded-full" style={{ background: paymentColors[method] }} /><span className="text-[#667187]">{t(paymentLabels[method] ?? method)}</span><b className="text-[#354055]">ETB {birr.format(amount / 100)}</b></li>)}</ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function HeroMetric({ icon, label, value, suffix, warning = false }: { icon: React.ReactNode; label: string; value: string; suffix?: string; warning?: boolean }) {
  return <div className={`min-w-0 rounded-md border border-white/10 px-3 py-3 ${warning ? 'bg-[#B82A1D]/20' : 'bg-white/[0.06]'}`}><div className="flex items-start justify-between gap-1"><p className="min-h-7 text-[9px] leading-4 text-white/65">{label}</p><span className={warning ? 'text-[#FFC83D]' : 'text-white/70'}>{icon}</span></div><p className="mt-2 truncate text-[18px] font-bold text-white">{value}{suffix && <small className="ml-1 text-[9px] font-medium text-white/60">{suffix}</small>}</p></div>
}
