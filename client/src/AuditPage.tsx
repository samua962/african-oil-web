import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { listAudit, type AuditEntry } from './api/ops'

const dateTime = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Africa/Addis_Ababa' })
const entities = ['', 'User', 'Product', 'Sale', 'StockMovementBatch', 'PurchaseOrder']
const redActions = new Set(['LOGIN_LOCKED', 'SALE_VOIDED', 'USER_PASSWORD_RESET_BY_ADMIN', 'STOCK_LOSS_RECORDED'])

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    listAudit(page, entity)
      .then((result) => { if (active) { setLogs(result.logs); setTotalPages(Math.max(1, result.totalPages)); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load the audit log.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, entity])

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">Administration</p>
            <h1 className="mt-1.5 text-[27px] font-bold">Audit log</h1>
            <p className="mt-1 text-[12px] text-[#7C8493]">Who changed prices, stock, sales and accounts.</p>
          </div>
          <select value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1) }} aria-label="Filter by record type" className="h-10 rounded-md border border-[#DDE2EC] bg-white px-3 text-[12px]">{entities.map((value) => <option key={value} value={value}>{value || 'All records'}</option>)}</select>
        </div>
        {error && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{error}</p>}
        <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white">
          {loading ? <div className="flex h-40 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />Loading</div> : logs.length === 0 ? <p className="px-5 py-9 text-center text-[12px] text-[#7C8493]">No activity recorded yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-[#F9FAFC] text-[10px] uppercase tracking-wide text-[#8992A1]"><th className="px-5 py-3">When</th><th className="px-3 py-3">Who</th><th className="px-3 py-3">Action</th><th className="px-5 py-3">Details</th></tr></thead><tbody className="divide-y divide-[#EDF0F5]">{logs.map((log) => <tr key={log.id} className="align-top"><td className="whitespace-nowrap px-5 py-3 text-[11px] text-[#667187]">{dateTime.format(new Date(log.createdAt))}</td><td className="px-3 py-3 text-[11px] text-[#354055]">{log.actor?.name ?? 'System'}<span className="block text-[10px] text-[#929BAC]">{log.ip ?? ''}</span></td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[10px] font-semibold ${redActions.has(log.action) ? 'bg-[#FCE4E1] text-[#B82A1D]' : 'bg-[#EDF2FB] text-[#1B449C]'}`}>{log.action.replaceAll('_', ' ').toLowerCase()}</span><span className="mt-1 block text-[10px] text-[#929BAC]">{log.entity}</span></td><td className="max-w-[360px] break-words px-5 py-3 font-mono text-[10px] text-[#667187]">{log.details ? JSON.stringify(log.details) : ''}</td></tr>)}</tbody></table></div>
          )}
          <div className="flex items-center justify-between border-t border-[#EDF0F5] px-5 py-3 text-[11px] text-[#667187]"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-8 rounded-md border border-[#DDE2EC] px-3 font-semibold text-[#1B449C] disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="h-8 rounded-md border border-[#DDE2EC] px-3 font-semibold text-[#1B449C] disabled:opacity-40">Next</button></div></div>
        </section>
      </div>
    </main>
  )
}
