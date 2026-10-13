import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Clock3, LoaderCircle, Printer, RefreshCw, ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthContext'
import { closeShift, getCurrentShift, getShiftHistory, openShift, type ClosedShift, type CurrentShift } from './api/shifts'
import type { PaymentMethod } from './api/sales'
import { usePrint } from './usePrint'
import { ShiftReportView } from './PrintViews'

const etb = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const methodNames: Record<PaymentMethod, string> = { CASH: 'Cash', TELEBIRR: 'Telebirr', CBE_BIRR: 'CBE Birr', CARD: 'Card' }
const methods: PaymentMethod[] = ['CASH', 'TELEBIRR', 'CBE_BIRR', 'CARD']
const dateTime = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' })

export default function ShiftPage() {
  const { user } = useAuth()
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [history, setHistory] = useState<ClosedShift[]>([])
  const [openingFloat, setOpeningFloat] = useState('0.00')
  const [cashCounted, setCashCounted] = useState('')
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const report = usePrint((closed: ClosedShift) => <ShiftReportView shift={closed} />)

  const canCloseCurrent = user?.role !== 'CASHIER' || shift?.openedBy.id === user?.id
  const productVarianceCount = useMemo(() => shift?.products.filter((product) => {
    const entered = physicalCounts[product.productId]
    return entered !== undefined && entered !== '' && Number(entered) !== product.expectedQuantity
  }).length ?? 0, [physicalCounts, shift])

  useEffect(() => {
    let active = true
    Promise.all([getCurrentShift(), getShiftHistory()])
      .then(([current, closed]) => {
        if (!active) return
        setShift(current)
        setHistory(closed)
        setPhysicalCounts(Object.fromEntries((current?.products ?? []).map((product) => [product.productId, ''])))
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load shift information.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refreshKey])

  const refresh = () => {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  const handleOpen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const opened = await openShift(Number(openingFloat))
      setShift(opened)
      setPhysicalCounts(Object.fromEntries(opened.products.map((product) => [product.productId, ''])))
      setMessage('Shift opened. Opening inventory has been snapshotted for reconciliation.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open shift.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!shift) return
    setError('')
    setMessage('')
    const incomplete = shift.products.find((product) => physicalCounts[product.productId] === undefined || physicalCounts[product.productId] === '')
    if (incomplete) {
      setError(`Enter the physical count for ${incomplete.name}.`)
      return
    }
    setSaving(true)
    try {
      const result = await closeShift(shift.id, Number(cashCounted), shift.products.map((product) => ({
        productId: product.productId,
        physicalQuantity: Number(physicalCounts[product.productId]),
      })))
      const varianceCount = result.reconciliations.filter((item) => item.variance !== 0).length
      setShift(null)
      setCashCounted('')
      setMessage(`Shift closed. ${varianceCount} product variance${varianceCount === 1 ? '' : 's'} recorded; cash variance ETB ${etb.format(result.shift.cashVarianceCents / 100)}.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not close shift.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">Cashier controls</p>
            <h1 className="mt-1.5 text-[27px] font-bold">Shift reconciliation</h1>
            <p className="mt-1 text-[12px] text-[#7C8493]">Review payment totals, count stock, and close the till.</p>
          </div>
          <button onClick={refresh} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#DDE2EC] bg-white px-3 text-[11px] font-semibold text-[#1B449C] disabled:opacity-50"><RefreshCw size={14} />Refresh</button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{error}</p>}
        {message && <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-[#D7E4D9] bg-[#F2F8F2] px-4 py-3 text-[12px] text-[#326B45]"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{message}</p>}

        {loading ? <div className="flex h-48 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />Loading shift</div> : !shift ? (
          <section className="max-w-[620px] rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-7">
            <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><Clock3 size={18} /></span><div><h2 className="text-[15px] font-semibold">No shift is open</h2><p className="mt-1 text-[11px] text-[#8992A1]">Open a till before recording sales. Opening inventory will be snapshotted.</p></div></div>
            <form onSubmit={handleOpen} className="flex flex-wrap items-end gap-3">
              <Field label="Opening cash float (ETB)"><input required type="number" min="0" max="1000000" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} /></Field>
              <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white hover:bg-[#163981] disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}Open shift</button>
            </form>
          </section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-lg border border-[#D7E1F5] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">Shift open</h2><span className="rounded bg-[#EDF2FB] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1B449C]">Active</span></div><p className="mt-1 text-[11px] text-[#8992A1]">Opened by {shift.openedBy.name} · {dateTime.format(new Date(shift.openedAt))}</p></div>
                <div className="text-right"><p className="text-[10px] text-[#8992A1]">Opening float</p><p className="text-[14px] font-bold text-[#354055]">ETB {etb.format(shift.openingFloatCents / 100)}</p></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="Sales" value={`${shift.saleCount}`} /><Summary label="Sales total" value={`ETB ${etb.format(shift.salesTotalCents / 100)}`} /><Summary label="Expected cash" value={`ETB ${etb.format(shift.expectedCashCents / 100)}`} /><Summary label="Count variances" value={`${productVarianceCount}`} warning={productVarianceCount > 0} /></div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{methods.map((method) => <div key={method} className="rounded-md bg-[#F9FAFC] px-3 py-2.5"><p className="text-[10px] text-[#8992A1]">{methodNames[method]}</p><p className="mt-1 text-[12px] font-semibold text-[#354055]">ETB {etb.format(shift.paymentTotals[method] / 100)}</p></div>)}</div>
            </section>

            {canCloseCurrent ? (
              <form onSubmit={handleClose} className="rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EDF0F5] px-5 py-4 sm:px-6"><div><h2 className="text-[14px] font-semibold">Physical stock count</h2><p className="mt-1 text-[11px] text-[#8992A1]">Expected quantities include this shift’s sales, receipts, and losses.</p></div><span className="inline-flex items-center gap-1.5 text-[10px] text-[#667187]"><ShieldAlert size={14} className="text-[#E38505]" />Variances are saved for audit</span></div>
                {shift.products.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#7C8493]">No active products to count.</p> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead><tr className="bg-[#F9FAFC] text-[10px] uppercase tracking-wide text-[#8992A1]"><th className="px-5 py-3">Product</th><th className="px-3 py-3">At opening</th><th className="px-3 py-3">Expected</th><th className="px-3 py-3">Physical count</th><th className="px-5 py-3">Variance</th></tr></thead><tbody className="divide-y divide-[#EDF0F5]">{shift.products.map((product) => { const value = physicalCounts[product.productId] ?? ''; const variance = value === '' ? null : Number(value) - product.expectedQuantity; return <tr key={product.productId}><td className="px-5 py-3"><p className="text-[11px] font-semibold text-[#354055]">{product.name}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{product.sku}{product.packageSize ? ` · ${product.packageSize}` : ''}</p></td><td className="px-3 py-3 text-[11px] text-[#667187]">{product.openingQuantity}</td><td className="px-3 py-3 text-[11px] font-semibold text-[#354055]">{product.expectedQuantity}</td><td className="px-3 py-3"><input aria-label={`Physical count for ${product.name}`} required type="number" min="0" max="1000000" step="1" value={value} onChange={(event) => setPhysicalCounts((current) => ({ ...current, [product.productId]: event.target.value }))} className="h-9 w-24 rounded-md border border-[#DDE2EC] px-2 text-[12px] outline-none focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]" /></td><td className={`px-5 py-3 text-[11px] font-bold ${variance === null || variance === 0 ? 'text-[#8992A1]' : 'text-[#B82A1D]'}`}>{variance === null ? '—' : variance > 0 ? `+${variance}` : variance}</td></tr>})}</tbody></table></div>
                )}
                <div className="flex flex-col gap-4 border-t border-[#EDF0F5] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6"><Field label={`Cash counted (ETB) · expected ${etb.format(shift.expectedCashCents / 100)}`}><input required type="number" min="0" max="1000000" step="0.01" value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} /></Field><button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#B82A1D] px-4 text-[11px] font-semibold text-white hover:bg-[#982319] disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}Close shift &amp; reconcile</button></div>
              </form>
            ) : <p className="rounded-md border border-[#F3D8B1] bg-[#FFF4E4] px-4 py-3 text-[12px] text-[#8B5806]">This shift was opened by another cashier. A manager can close it after the physical count.</p>}
          </div>
        )}

        <section className="mt-7 overflow-hidden rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]"><div className="border-b border-[#EDF0F5] px-5 py-4"><h2 className="text-[14px] font-semibold">Closed shifts</h2><p className="mt-1 text-[11px] text-[#8992A1]">Recent cash and stock reconciliation records.</p></div>{history.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#7C8493]">No shifts have been closed yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="bg-[#F9FAFC] text-[10px] uppercase tracking-wide text-[#8992A1]"><th className="px-5 py-3">Closed</th><th className="px-3 py-3">Cashier</th><th className="px-3 py-3">Sales</th><th className="px-3 py-3">Cash variance</th><th className="px-3 py-3">Stock variances</th><th className="px-5 py-3"><span className="sr-only">Report</span></th></tr></thead><tbody className="divide-y divide-[#EDF0F5]">{history.map((closed) => <tr key={closed.id}><td className="px-5 py-3 text-[11px] text-[#667187]">{closed.closedAt ? dateTime.format(new Date(closed.closedAt)) : '—'}</td><td className="px-3 py-3 text-[11px] text-[#667187]">{closed.openedBy.name}</td><td className="px-3 py-3 text-[11px] font-semibold text-[#354055]">{closed.saleCount} · ETB {etb.format(closed.salesTotalCents / 100)}</td><td className={`px-3 py-3 text-[11px] font-semibold ${(closed.cashVarianceCents ?? 0) === 0 ? 'text-[#1B449C]' : 'text-[#B82A1D]'}`}>ETB {etb.format((closed.cashVarianceCents ?? 0) / 100)}</td><td className={`px-3 py-3 text-[11px] font-semibold ${closed.varianceCount ? 'text-[#B82A1D]' : 'text-[#1B449C]'}`}>{closed.varianceCount}</td><td className="px-5 py-3 text-right"><button type="button" onClick={() => report.print(closed)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B449C] hover:underline"><Printer size={12} />Print</button></td></tr>)}</tbody></table></div>}</section>
      </div>
      {report.node}
    </main>
  )
}

function Summary({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="rounded-md border border-[#EDF0F5] px-3 py-2.5"><p className="text-[10px] text-[#8992A1]">{label}</p><p className={`mt-1 text-[14px] font-bold ${warning ? 'text-[#B82A1D]' : 'text-[#354055]'}`}>{value}</p></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9]">{children}</span></label>
}
