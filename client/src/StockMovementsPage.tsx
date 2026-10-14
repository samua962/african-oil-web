import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useAuth } from './AuthContext'
import { createMovement, createSupplier, listMovements, listSuppliers, type MovementType, type StockMovement, type Supplier } from './api/movements'
import { useLanguage } from './LanguageContext'
import { listProducts, type Product } from './api/products'

type Line = { productId: string; quantity: number; lotNumber?: string; expiryDate?: string }
const newKey = () => crypto.randomUUID()
const dateTime = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' })

export default function StockMovementsPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [mode, setMode] = useState<MovementType | 'HISTORY'>('RECEIPT')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [items, setItems] = useState<Line[]>([{ productId: '', quantity: 1 }])
  const [idempotencyKey, setIdempotencyKey] = useState(newKey)
  const [saving, setSaving] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [supplierError, setSupplierError] = useState('')
  const [supplierSaving, setSupplierSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listSuppliers(), listProducts({ pageSize: 100 }), listMovements()])
      .then(([supplierList, productList, movementList]) => {
        if (!active) return
        setSuppliers(supplierList)
        setProducts(productList.products)
        setMovements(movementList.movements)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load stock movements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const refreshMovements = async () => {
    const [movementList, productList] = await Promise.all([listMovements(), listProducts({ pageSize: 100 })])
    setMovements(movementList.movements)
    setProducts(productList.products)
  }

  const submitMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (items.some((item) => !item.productId)) {
      setError('Choose a product for every movement line.')
      return
    }
    setSaving(true)
    try {
      const result = await createMovement(mode as MovementType, {
        idempotencyKey,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          ...(mode === 'RECEIPT' && item.lotNumber?.trim() ? { lotNumber: item.lotNumber.trim() } : {}),
          ...(mode === 'RECEIPT' && item.expiryDate ? { expiryDate: item.expiryDate } : {}),
        })),
        ...(mode === 'RECEIPT' ? { supplierId } : { reason: reason.trim() }),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      })
      await refreshMovements()
      setItems([{ productId: '', quantity: 1 }])
      setSupplierId('')
      setReference('')
      setReason('')
      setIdempotencyKey(newKey())
      setMessage(result.replayed ? 'This movement was already recorded; no stock was changed again.' : mode === 'RECEIPT' ? 'Shipment received and stock updated.' : 'Loss adjustment recorded and stock updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the stock movement.')
    } finally {
      setSaving(false)
    }
  }

  const submitSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSupplierError('')
    setSupplierSaving(true)
    try {
      const supplier = await createSupplier(supplierName.trim(), supplierPhone.trim())
      setSuppliers((current) => [...current, supplier].sort((left, right) => left.name.localeCompare(right.name)))
      setSupplierId(supplier.id)
      setCreatingSupplier(false)
      setSupplierName('')
      setSupplierPhone('')
    } catch (cause) {
      setSupplierError(cause instanceof Error ? cause.message : 'Could not create supplier.')
    } finally {
      setSupplierSaving(false)
    }
  }

  const addLine = () => setItems((current) => [...current, { productId: '', quantity: 1 }])
  const updateLine = (index: number, patch: Partial<Line>) => setItems((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, ...patch } : item))
  const removeLine = (index: number) => setItems((current) => current.filter((_, lineIndex) => lineIndex !== index))
  const modeChanged = (nextMode: MovementType | 'HISTORY') => {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Inventory control')}</p><h1 className="mt-1.5 text-[27px] font-bold">{t('Stock movements')}</h1><p className="mt-1 text-[12px] text-[#7C8493]">{t('Record supplier receipts and loss adjustments.')}</p></div><div className="text-right"><p className="text-[11px] text-[#7C8493]">{t('Signed in as')}</p><p className="text-[12px] font-semibold text-[#3E485B]">{user?.name}</p></div></div>

        <div className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-md border border-[#DDE2EC] bg-white p-1">
          <ModeButton active={mode === 'RECEIPT'} onClick={() => modeChanged('RECEIPT')}><ArrowDownLeft size={14} />{t('Receive stock')}</ModeButton>
          <ModeButton active={mode === 'LOSS'} onClick={() => modeChanged('LOSS')}><ArrowUpRight size={14} />{t('Record loss')}</ModeButton>
          <ModeButton active={mode === 'HISTORY'} onClick={() => modeChanged('HISTORY')}><RefreshCw size={14} />{t('Movement history')}</ModeButton>
        </div>

        {error && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-md border border-[#D7E4D9] bg-[#F2F8F2] px-4 py-3 text-[12px] text-[#326B45]">{message}</p>}

        {mode !== 'HISTORY' ? (
          <form onSubmit={submitMovement} className="space-y-4">
            {mode === 'RECEIPT' ? <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-[14px] font-semibold">{t('Shipment details')}</h2><p className="mt-1 text-[11px] text-[#8992A1]">{t('Supplier and delivery reference for this receipt.')}</p></div><button type="button" onClick={() => { setSupplierError(''); setCreatingSupplier(true) }} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#DDE2EC] px-2.5 text-[10px] font-semibold text-[#1B449C] hover:bg-[#F3F6FC]"><Plus size={13} />{t('Add supplier')}</button></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('Supplier')}><select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">{t('Select supplier')}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
                <Field label={t('Invoice / delivery reference (optional)')}><input maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t('Invoice number or delivery note')} /></Field>
              </div>
              {suppliers.length === 0 && <p className="mt-3 text-[11px] text-[#B56A00]">Add a supplier before recording the first receipt.</p>}
            </section> : <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
              <h2 className="text-[14px] font-semibold">Loss details</h2><p className="mt-1 text-[11px] text-[#8992A1]">Explain damaged, expired, missing, or otherwise written-off stock.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Reason"><select required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Select reason</option><option value="DAMAGED">Damaged</option><option value="EXPIRED">Expired</option><option value="MISSING">Missing / shrinkage</option><option value="OTHER">Other</option></select></Field><Field label="Reference (optional)"><input maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Incident or inspection reference" /></Field></div>
            </section>}

            <section className="rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F5] px-5 py-4 sm:px-6"><div><h2 className="text-[14px] font-semibold">Product lines</h2><p className="mt-1 text-[11px] text-[#8992A1]">{mode === 'RECEIPT' ? 'Quantities received from this supplier.' : 'Quantities removed from available stock.'}</p></div><button type="button" onClick={addLine} disabled={products.length === 0} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE2EC] px-2.5 text-[10px] font-semibold text-[#1B449C] hover:bg-[#F3F6FC] disabled:opacity-50"><Plus size={13} />Add product</button></div>
              {loading ? <div className="flex h-32 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />Loading products</div> : products.length === 0 ? <p className="px-5 py-9 text-center text-[12px] text-[#7C8493]">Create products in Inventory before recording stock.</p> : <div className="divide-y divide-[#EDF0F5]">
                {items.map((item, index) => <div key={index} className={`grid grid-cols-1 items-end gap-3 px-5 py-4 sm:px-6 ${mode === 'RECEIPT' ? 'sm:grid-cols-[minmax(0,1fr)_100px_130px_150px_40px]' : 'sm:grid-cols-[minmax(0,1fr)_150px_40px]'}`}>
                  <Field label={index === 0 ? t('Product') : `${t('Product')} ${index + 1}`}><select required value={item.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}><option value="">{t('Select product')}</option>{products.map((product) => <option key={product.id} value={product.id} disabled={items.some((other, otherIndex) => otherIndex !== index && other.productId === product.id)}>{product.name} · {product.sku} · {product.quantityOnHand} {t('in stock')}</option>)}</select></Field>
                  <Field label={t('Quantity')}><input required type="number" min="1" max={mode === 'LOSS' ? products.find((product) => product.id === item.productId)?.quantityOnHand ?? 1_000_000 : 1_000_000} step="1" value={item.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></Field>
                  {mode === 'RECEIPT' && <><Field label={t('Lot no.')}><input maxLength={60} value={item.lotNumber ?? ''} onChange={(event) => updateLine(index, { lotNumber: event.target.value })} placeholder={t('Optional')} /></Field><Field label={t('Expiry date')}><input type="date" value={item.expiryDate ?? ''} onChange={(event) => updateLine(index, { expiryDate: event.target.value })} /></Field></>}
                  <button type="button" disabled={items.length === 1} onClick={() => removeLine(index)} title="Remove line" aria-label="Remove product line" className="mb-0.5 flex size-9 items-center justify-center rounded-md text-[#8992A1] hover:bg-[#FCF0EE] hover:text-[#B82A1D] disabled:opacity-30"><Trash2 size={15} /></button>
                </div>)}
              </div>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F5] px-5 py-4 sm:px-6"><p className="max-w-[480px] text-[10px] text-[#8992A1]">Each movement is recorded with your account and timestamp. Retrying a submitted batch with the same key won’t apply it twice.</p><button disabled={saving || loading || products.length === 0 || (mode === 'RECEIPT' && !supplierId)} className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'RECEIPT' ? 'bg-[#1B449C] hover:bg-[#163981]' : 'bg-[#B82A1D] hover:bg-[#982319]'}`}>{saving && <LoaderCircle size={14} className="animate-spin" />}{mode === 'RECEIPT' ? 'Record receipt' : 'Record loss adjustment'}</button></div>
            </section>
          </form>
        ) : (
          <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
            {loading ? <div className="flex h-48 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />Loading movement history</div> : movements.length === 0 ? <div className="px-5 py-12 text-center text-[12px] text-[#7C8493]">No stock movements recorded yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[790px] border-collapse text-left"><thead><tr className="bg-[#F9FAFC] text-[10px] font-semibold uppercase tracking-[0.6px] text-[#8992A1]"><th className="px-5 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Quantity</th><th className="px-3 py-3">Supplier / reason</th><th className="px-5 py-3">Recorded by</th></tr></thead><tbody className="divide-y divide-[#EDF0F5]">{movements.map((movement) => <tr key={movement.id} className="hover:bg-[#FCFCFE]"><td className="px-5 py-3.5 text-[10px] text-[#778296]">{dateTime.format(new Date(movement.createdAt))}</td><td className="px-3 py-3.5"><span className={`rounded px-2 py-1 text-[10px] font-semibold ${movement.type === 'RECEIPT' ? 'bg-[#EDF2FB] text-[#1B449C]' : 'bg-[#FCF0EE] text-[#B82A1D]'}`}>{movement.type === 'RECEIPT' ? 'Stock in' : 'Loss'}</span></td><td className="px-3 py-3.5"><p className="text-[11px] font-semibold text-[#354055]">{movement.product.name}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{movement.product.sku}</p></td><td className={`px-3 py-3.5 text-[12px] font-bold ${movement.quantityDelta > 0 ? 'text-[#1B449C]' : 'text-[#B82A1D]'}`}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</td><td className="px-3 py-3.5 text-[11px] text-[#667187]">{movement.supplier?.name ?? movement.reason ?? '—'}{movement.reference ? <p className="mt-0.5 text-[10px] text-[#929BAC]">Ref: {movement.reference}</p> : null}</td><td className="px-5 py-3.5 text-[11px] text-[#667187]">{movement.createdBy.name}</td></tr>)}</tbody></table></div>}
            <div className="flex items-center justify-between border-t border-[#EDF0F5] px-5 py-3 text-[10px] text-[#8992A1]"><span>Showing latest {movements.length} movements</span><button onClick={() => { setLoading(true); void refreshMovements().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not refresh movements.')).finally(() => setLoading(false)) }} className="inline-flex items-center gap-1.5 font-semibold text-[#1B449C]"><RefreshCw size={12} />Refresh</button></div>
          </section>
        )}
      </div>

      {creatingSupplier && <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#172035]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreatingSupplier(false) }}><section role="dialog" aria-modal="true" aria-labelledby="supplier-title" className="w-full max-w-[440px] rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 id="supplier-title" className="text-[18px] font-bold">Add supplier</h2><p className="mt-1 text-[11px] text-[#7C8493]">Supplier will be available for future receipts.</p></div><button type="button" onClick={() => setCreatingSupplier(false)} aria-label="Close supplier form" className="flex size-8 items-center justify-center rounded text-[#7C8493] hover:bg-[#F3F5F9]"><X size={16} /></button></div><form onSubmit={submitSupplier} className="space-y-4"><Field label="Supplier name"><input required minLength={2} maxLength={120} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} /></Field><Field label="Phone (optional)"><input maxLength={40} value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} /></Field>{supplierError && <p role="alert" className="text-[11px] text-[#A72419]">{supplierError}</p>}<div className="flex justify-end gap-2 border-t border-[#EDF0F5] pt-4"><button type="button" onClick={() => setCreatingSupplier(false)} className="h-9 rounded-md border border-[#DDE2EC] px-3 text-[11px] font-semibold text-[#58647A]">Cancel</button><button disabled={supplierSaving} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white disabled:opacity-60">{supplierSaving && <LoaderCircle size={14} className="animate-spin" />}Save supplier</button></div></form></section></div>}
    </main>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded px-3 text-[11px] font-semibold ${active ? 'bg-[#EDF2FB] text-[#1B449C]' : 'text-[#667187] hover:bg-[#F5F6F9]'}`}>{children}</button>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[#DDE2EC] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:outline-none [&_select]:focus:border-[#1B449C] [&_select]:focus:ring-2 [&_select]:focus:ring-[#E6ECF9]">{children}</span></label>
}