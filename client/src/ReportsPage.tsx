import { useEffect, useState } from 'react'
import { AlertTriangle, Download, LoaderCircle } from 'lucide-react'
import { getExpiring, getSalesReport, salesReportCsvUrl, type ExpiryBatch, type SalesReport } from './api/ops'
import { useLanguage } from './LanguageContext'

const money = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date())
const daysAgoKey = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date(Date.now() - days * 86_400_000))
const methodNames: Record<string, string> = { CASH: 'Cash', TELEBIRR: 'Telebirr', CBE_BIRR: 'CBE Birr', CARD: 'Card' }
const inputClass = 'h-10 rounded-md border border-[#DDE2EC] bg-white px-3 text-[12px] outline-none focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]'

export default function ReportsPage() {
  const { t } = useLanguage()
  const [from, setFrom] = useState(() => daysAgoKey(29))
  const [to, setTo] = useState(todayKey)
  const [expiryDays, setExpiryDays] = useState(60)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [batches, setBatches] = useState<ExpiryBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!from || !to || from > to) return
    let active = true
    setLoading(true)
    getSalesReport(from, to)
      .then((result) => { if (active) { setReport(result); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load the report.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, to])

  useEffect(() => {
    let active = true
    getExpiring(expiryDays).then((result) => { if (active) setBatches(result) }).catch(() => { if (active) setBatches([]) })
    return () => { active = false }
  }, [expiryDays])

  const maxDay = Math.max(1, ...(report?.byDay.map((day) => day.totalCents) ?? [1]))
  const validRange = from && to && from <= to

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Insights')}</p>
            <h1 className="mt-1.5 text-[27px] font-bold">{t('Reports')}</h1>
            <p className="mt-1 text-[12px] text-[#7C8493]">{t('Sales, profit and expiring stock. Profit uses current cost prices.')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{t('From')}</span><input type="date" className={inputClass} value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{t('To')}</span><input type="date" className={inputClass} value={to} min={from} max={todayKey()} onChange={(event) => setTo(event.target.value)} /></label>
          </div>
        </div>

        {!validRange && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">Choose a start date that is not after the end date.</p>}
        {error && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{error}</p>}

        {loading && !report ? <div className="flex h-40 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />Loading report</div> : report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[[t('Sales'), `ETB ${money.format(report.totals.salesCents / 100)}`], [t('Cost of goods'), `ETB ${money.format(report.totals.costCents / 100)}`], [t('Gross profit'), `ETB ${money.format(report.totals.profitCents / 100)}`], [t('Transactions'), String(report.totals.transactions)], [t('Units sold'), String(report.totals.units)]].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#E3E7EF] bg-white px-4 py-3.5"><p className="text-[10px] uppercase tracking-wide text-[#8992A1]">{label}</p><p className={`mt-1.5 text-[16px] font-bold ${label === t('Gross profit') && report.totals.profitCents < 0 ? 'text-[#B82A1D]' : 'text-[#202638]'}`}>{value}</p></div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-lg border border-[#E3E7EF] bg-white p-5">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">{t('Daily sales')}</h2><a href={salesReportCsvUrl(from, to, 'days')} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B449C] hover:underline"><Download size={12} />CSV</a></div>
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {report.byDay.map((day) => <div key={day.date} className="flex items-center gap-3 text-[10px] text-[#667187]"><span className="w-[72px] shrink-0">{day.date}</span><span className="h-3 flex-1 rounded bg-[#F1F3F8]"><span className="block h-3 rounded bg-[#1B449C]" style={{ width: `${(day.totalCents / maxDay) * 100}%` }} /></span><span className="w-[92px] shrink-0 text-right font-semibold text-[#354055]">{money.format(day.totalCents / 100)}</span></div>)}
                </div>
              </section>
              <section className="rounded-lg border border-[#E3E7EF] bg-white p-5">
                <h2 className="mb-3 text-[14px] font-semibold">{t('By payment method')}</h2>
                <div className="space-y-2">{Object.entries(report.byPayment).map(([method, cents]) => <div key={method} className="flex items-center justify-between rounded-md bg-[#F9FAFC] px-3 py-2.5 text-[11px]"><span className="text-[#667187]">{methodNames[method] ?? method}</span><span className="font-semibold text-[#354055]">ETB {money.format(cents / 100)}</span></div>)}</div>
              </section>
            </div>

            <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white">
              <div className="flex items-center justify-between border-b border-[#EDF0F5] px-5 py-4"><h2 className="text-[14px] font-semibold">{t('Product performance')}</h2><a href={salesReportCsvUrl(from, to, 'products')} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B449C] hover:underline"><Download size={12} />{t('Export CSV')}</a></div>
              {report.byProduct.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#7C8493]">No sales in this period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><thead><tr className="bg-[#F9FAFC] text-[10px] uppercase tracking-wide text-[#8992A1]"><th className="px-5 py-3">Product</th><th className="px-3 py-3">Units</th><th className="px-3 py-3">Sales</th><th className="px-3 py-3">Cost</th><th className="px-5 py-3">Profit</th></tr></thead><tbody className="divide-y divide-[#EDF0F5]">{report.byProduct.map((row) => <tr key={row.sku}><td className="px-5 py-3"><p className="text-[11px] font-semibold text-[#354055]">{row.name}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{row.sku}</p></td><td className="px-3 py-3 text-[11px] text-[#667187]">{row.units}</td><td className="px-3 py-3 text-[11px] text-[#354055]">{money.format(row.salesCents / 100)}</td><td className="px-3 py-3 text-[11px] text-[#667187]">{money.format(row.costCents / 100)}</td><td className={`px-5 py-3 text-[11px] font-semibold ${row.profitCents < 0 ? 'text-[#B82A1D]' : 'text-[#1B6B3A]'}`}>{money.format(row.profitCents / 100)}</td></tr>)}</tbody></table></div>}
            </section>
          </div>
        )}

        <section className="mt-4 overflow-hidden rounded-lg border border-[#E3E7EF] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F5] px-5 py-4">
            <div><h2 className="text-[14px] font-semibold">{t('Expiring stock')}</h2><p className="mt-1 text-[11px] text-[#8992A1]">{t('Lots received with an expiry date and still in stock.')}</p></div>
            <select className={inputClass} value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))} aria-label="Expiry window">{[30, 60, 90, 180].map((days) => <option key={days} value={days}>Next {days} days</option>)}</select>
          </div>
          {batches.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#7C8493]">{t('Nothing is expiring in this window.')}</p> : <div className="divide-y divide-[#EDF0F5]">{batches.map((batch) => <div key={batch.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#354055]">{batch.product.name}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{batch.product.sku}{batch.lotNumber ? ` · ${t('Lot')} ${batch.lotNumber}` : ''} · {batch.quantityRemaining} {t('left')}</p></div><span className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold ${batch.expired ? 'bg-[#FCE4E1] text-[#B82A1D]' : 'bg-[#FFF2DE] text-[#9A5B00]'}`}>{batch.expired && <AlertTriangle size={11} />}{t(batch.expired ? 'Expired' : 'Expires')} {batch.expiryDate}</span></div>)}</div>}
        </section>
      </div>
    </main>
  )
}
