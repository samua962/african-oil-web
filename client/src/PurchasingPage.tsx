import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { createOrder, getSuggestions, listOrders, receiveOrder, setOrderStatus, type PurchaseOrder, type ReorderSuggestion } from './api/ops'
import { listSuppliers, type Supplier } from './api/movements'

const money = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium' })
const statusStyle: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'bg-[#F1F3F8] text-[#667187]',
  ORDERED: 'bg-[#EDF2FB] text-[#1B449C]',
  RECEIVED: 'bg-[#E8F5EC] text-[#1B6B3A]',
  CANCELLED: 'bg-[#FCE4E1] text-[#B82A1D]',
}
const inputClass = 'h-9 rounded-md border border-[#DDE2EC] bg-white px-2 text-[12px] outline-none focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]'

type Pick = { checked: boolean; quantity: string; cost: string }

export default function PurchasingPage() {
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [supplierId, setSupplierId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    const [nextSuggestions, nextOrders, nextSuppliers] = await Promise.all([getSuggestions(), listOrders(), listSuppliers()])
    setSuggestions(nextSuggestions)
    setOrders(nextOrders)
    setSuppliers(nextSuppliers)
    setPicks(Object.fromEntries(nextSuggestions.map((item) => [item.productId, { checked: true, quantity: String(item.suggestedQuantity), cost: (item.unitCostCents / 100).toFixed(2) }])))
    setSupplierId((current) => current || nextSuggestions.find((item) => item.lastSupplier)?.lastSupplier?.id || '')
  }

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load purchasing data.')).finally(() => setLoading(false))
  }, [])

  const selected = useMemo(() => suggestions.filter((item) => picks[item.productId]?.checked), [suggestions, picks])
  const orderTotal = selected.reduce((sum, item) => sum + (Number(picks[item.productId].quantity) || 0) * (Number(picks[item.productId].cost) || 0), 0)
  const setPick = (id: string, patch: Partial<Pick>) => setPicks((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await load()
      setMessage(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const create = () => {
    if (!supplierId) { setError('Choose a supplier for this order.'); return }
    const items = selected.map((item) => ({ productId: item.productId, quantity: Number(picks[item.productId].quantity), unitCostEtb: Number(picks[item.productId].cost) }))
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitCostEtb) || item.unitCostEtb < 0)) {
      setError('Each selected line needs a whole quantity and a valid unit cost.')
      return
    }
    void run(() => createOrder(supplierId, items), 'Purchase order created as a draft.')
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">Inventory control</p>
          <h1 className="mt-1.5 text-[27px] font-bold">Purchasing</h1>
          <p className="mt-1 text-[12px] text-[#7C8493]">Reorder low-stock items and receive supplier deliveries.</p>
        </div>
        {error && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{error}</p>}
        {message && <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-[#D7E4D9] bg-[#F2F8F2] px-4 py-3 text-[12px] text-[#326B45]"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{message}</p>}

        {loading ? <div className="flex h-40 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />Loading</div> : (
          <div className="space-y-4">
            <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F5] px-5 py-4">
                <div><h2 className="text-[14px] font-semibold">Reorder suggestions</h2><p className="mt-1 text-[11px] text-[#8992A1]">Products at or below their reorder level. Quantities aim for two weeks of recent sales.</p></div>
                <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} aria-label="Supplier" className={`${inputClass} min-w-[180px]`}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
              </div>
              {suggestions.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#7C8493]">All products are above their reorder level.</p> : <>
                <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="bg-[#F9FAFC] text-[10px] uppercase tracking-wide text-[#8992A1]"><th className="px-5 py-3">Order</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">In stock</th><th className="px-3 py-3">Quantity</th><th className="px-5 py-3">Unit cost (ETB)</th></tr></thead><tbody className="divide-y divide-[#EDF0F5]">{suggestions.map((item) => { const pick = picks[item.productId]; return <tr key={item.productId}><td className="px-5 py-3"><input type="checkbox" aria-label={`Include ${item.name}`} checked={pick?.checked ?? false} onChange={(event) => setPick(item.productId, { checked: event.target.checked })} /></td><td className="px-3 py-3"><p className="text-[11px] font-semibold text-[#354055]">{item.name}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{item.sku}{item.lastSupplier ? ` · last from ${item.lastSupplier.name}` : ''}</p></td><td className="px-3 py-3 text-[11px] font-bold text-[#B82A1D]">{item.quantityOnHand} <span className="font-normal text-[#929BAC]">/ {item.reorderLevel}</span></td><td className="px-3 py-3"><input type="number" min={1} step={1} className={`${inputClass} w-24`} value={pick?.quantity ?? ''} onChange={(event) => setPick(item.productId, { quantity: event.target.value })} /></td><td className="px-5 py-3"><input type="number" min={0} step="0.01" className={`${inputClass} w-28`} value={pick?.cost ?? ''} onChange={(event) => setPick(item.productId, { cost: event.target.value })} /></td></tr> })}</tbody></table></div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F5] px-5 py-4"><p className="text-[12px] text-[#667187]">{selected.length} lines · <span className="font-semibold text-[#354055]">ETB {money.format(orderTotal)}</span></p><button disabled={busy || selected.length === 0} onClick={create} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white hover:bg-[#163981] disabled:opacity-60">{busy && <LoaderCircle size={14} className="animate-spin" />}Create purchase order</button></div>
              </>}
            </section>

            <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white">
              <div className="border-b border-[#EDF0F5] px-5 py-4"><h2 className="text-[14px] font-semibold">Purchase orders</h2></div>
              {orders.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#7C8493]">No purchase orders yet.</p> : <div className="divide-y divide-[#EDF0F5]">{orders.map((order) => <div key={order.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><p className="text-[12px] font-semibold text-[#354055]">{order.supplier.name}</p><span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${statusStyle[order.status]}`}>{order.status}</span></div><p className="mt-1 text-[10px] text-[#929BAC]">PO {order.id.slice(0, 8).toUpperCase()} · {dateFormat.format(new Date(order.createdAt))} · {order.createdBy.name} · ETB {money.format(order.totalCents / 100)}</p></div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    {order.status === 'DRAFT' && <button disabled={busy} onClick={() => void run(() => setOrderStatus(order.id, 'ORDERED'), 'Order marked as ordered.')} className="h-8 rounded-md bg-[#1B449C] px-3 text-white disabled:opacity-60">Mark ordered</button>}
                    {order.status === 'ORDERED' && <button disabled={busy} onClick={() => { if (window.confirm('Add every line of this order to stock now?')) void run(() => receiveOrder(order.id), 'Stock received and updated.') }} className="h-8 rounded-md bg-[#1B6B3A] px-3 text-white disabled:opacity-60">Receive stock</button>}
                    {(order.status === 'DRAFT' || order.status === 'ORDERED') && <button disabled={busy} onClick={() => void run(() => setOrderStatus(order.id, 'CANCELLED'), 'Order cancelled.')} className="h-8 rounded-md border border-[#E7C3BE] px-3 text-[#B82A1D] disabled:opacity-60">Cancel</button>}
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-[11px] text-[#667187]">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.product.name} <span className="text-[#929BAC]">({item.product.sku})</span></span><span>{item.quantity} × {money.format(item.unitCostCents / 100)}</span></li>)}</ul>
              </div>)}</div>}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
