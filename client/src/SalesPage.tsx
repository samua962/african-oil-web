import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUpRight, Ban, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { createSale, listSales, voidSale, type PaymentMethod, type Sale } from './api/sales'
import { findProductByBarcode, listProducts, type Product } from './api/products'
import { getCurrentShift, type CurrentShift } from './api/shifts'
import { usePrint } from './usePrint'
import { ReceiptView } from './PrintViews'

type Line = { productId: string; quantity: number }

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'TELEBIRR', label: 'Telebirr' },
  { value: 'CBE_BIRR', label: 'CBE Birr' },
]

const money = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SalesPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null)
  const [saleIdempotencyKey, setSaleIdempotencyKey] = useState(() => crypto.randomUUID())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: 1 }])
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const receipt = usePrint((sale: Sale) => <ReceiptView sale={sale} />)
  const canVoid = user?.role !== 'CASHIER'

  useEffect(() => {
    let active = true
    Promise.all([listProducts({ pageSize: 200 }), listSales(), getCurrentShift()])
      .then(([productList, saleList, activeShift]) => {
        if (!active) return
        setProducts(productList.products)
        setSales(saleList.sales)
        setCurrentShift(activeShift)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load sales data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const subtotal = useMemo(() => {
    return lines.reduce((total, line) => {
      const product = productMap.get(line.productId)
      if (!product) return total
      return total + product.sellingCents * line.quantity
    }, 0)
  }, [lines, productMap])

  const productMatches = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase()
    if (!normalizedSearch) return []
    return products.filter((product) => `${product.name} ${product.brand ?? ''} ${product.sku} ${product.barcode ?? ''}`.toLowerCase().includes(normalizedSearch)).slice(0, 6)
  }, [productSearch, products])

  const addLine = () => {
    setLines((current) => [...current, { productId: '', quantity: 1 }])
    setSaleIdempotencyKey(crypto.randomUUID())
  }
  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
    setSaleIdempotencyKey(crypto.randomUUID())
  }
  const removeLine = (index: number) => {
    setLines((current) => current.length > 1 ? current.filter((_, lineIndex) => lineIndex !== index) : [{ productId: '', quantity: 1 }])
    setSaleIdempotencyKey(crypto.randomUUID())
  }

  const addProduct = (product: Product) => {
    if (product.quantityOnHand < 1) {
      setError(`${product.name} is out of stock.`)
      return
    }
    const existingLine = lines.find((line) => line.productId === product.id)
    if (existingLine && existingLine.quantity >= product.quantityOnHand) {
      setError(`Only ${product.quantityOnHand} ${product.name} in stock.`)
      return
    }
    if (!existingLine && lines.filter((line) => line.productId).length >= 20) {
      setError('A sale can contain up to 20 different products.')
      return
    }
    setError('')
    if (existingLine) {
      setLines((current) => current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line))
    } else {
      const emptyLine = lines.findIndex((line) => !line.productId)
      if (emptyLine >= 0) updateLine(emptyLine, { productId: product.id, quantity: 1 })
      else setLines((current) => [...current, { productId: product.id, quantity: 1 }])
    }
    setSaleIdempotencyKey(crypto.randomUUID())
    setProductSearch('')
  }

  // Scanners type the code and press Enter: prefer an exact barcode/SKU match, then ask the server.
  const handleEnter = async () => {
    const code = productSearch.trim()
    if (!code) return
    const exact = products.find((product) => product.barcode === code || product.sku.toLowerCase() === code.toLowerCase())
    if (exact) {
      addProduct(exact)
      return
    }
    if (productMatches.length > 0) {
      addProduct(productMatches[0])
      return
    }
    try {
      const found = await findProductByBarcode(code)
      setProducts((current) => current.some((product) => product.id === found.id) ? current : [...current, found])
      addProduct(found)
    } catch {
      setError(`No product matches "${code}".`)
      setProductSearch('')
    }
  }

  const confirmVoid = async (saleId: string) => {
    setError('')
    setMessage('')
    try {
      await voidSale(saleId, voidReason.trim())
      const [nextSales, nextProducts] = await Promise.all([listSales(), listProducts({ pageSize: 200 })])
      setSales(nextSales.sales)
      setProducts(nextProducts.products)
      setVoidingId(null)
      setVoidReason('')
      setMessage('Sale voided and stock restored.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not void the sale.')
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!currentShift) {
      setError('Open a shift before recording sales.')
      return
    }
    const validLines = lines.filter((line) => line.productId)
    if (validLines.length === 0) {
      setError('Add at least one product to the sale.')
      return
    }
    for (const line of validLines) {
      const product = productMap.get(line.productId)
      if (!product) {
        setError('One or more selected products are unavailable.')
        return
      }
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > product.quantityOnHand) {
        setError(`Quantity for ${product.name} must be between 1 and ${product.quantityOnHand}.`)
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        idempotencyKey: saleIdempotencyKey,
        paymentMethod,
        items: validLines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      }
      const result = await createSale(payload)
      const [nextSales, nextProducts] = await Promise.all([listSales(), listProducts({ pageSize: 200 })])
      setSales(nextSales.sales)
      setProducts(nextProducts.products)
      setLines([{ productId: '', quantity: 1 }])
      setPaymentMethod('CASH')
      setSaleIdempotencyKey(crypto.randomUUID())
      setMessage(result.replayed ? 'This sale was already processed; no duplicate was recorded.' : `Sale completed for ${money.format(result.sale.totalCents / 100)} ETB.`)
      if (!result.replayed) receipt.print(result.sale)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete sale.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">Point of sale</p>
            <h1 className="mt-1.5 text-[27px] font-bold">Sales checkout</h1>
            <p className="mt-1 text-[12px] text-[#7C8493]">Process quick sales and update stock automatically.</p>
          </div>
          <div className="text-right text-[12px] text-[#7C8493]">
            <p>Cashier</p>
            <p className="font-semibold text-[#3E485B]">{user?.name}</p>
          </div>
        </div>

        {error && <p role="alert" className="mb-4 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-4 py-3 text-[12px] text-[#A72419]">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-md border border-[#D7E4D9] bg-[#F2F8F2] px-4 py-3 text-[12px] text-[#326B45]">{message}</p>}
        {!loading && !currentShift && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#F3D8B1] bg-[#FFF4E4] px-4 py-3"><p className="text-[12px] text-[#8B5806]">A shift must be open before you can record a sale.</p><Link to="/shifts" className="text-[11px] font-semibold text-[#1B449C]">Open shift</Link></div>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <form onSubmit={submit} className="space-y-4 rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-[14px] font-semibold">Sale items</h2><p className="mt-1 text-[11px] text-[#8992A1]">Current stock is checked before every sale.</p></div><button type="button" onClick={addLine} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE2EC] px-2.5 text-[10px] font-semibold text-[#1B449C] hover:bg-[#F3F6FC]"><Plus size={13} />Add item</button></div>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">Quick add by name, SKU or barcode</span>
              <span className="relative block">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#929BAC]" />
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleEnter() } }} placeholder="Scan barcode or search a product" className="h-10 w-full rounded-md border border-[#DDE2EC] pl-9 pr-3 text-[12px] outline-none focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]" />
              </span>
              {productSearch.trim() && <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-[#DDE2EC] bg-white shadow-sm">
                {productMatches.length > 0 ? productMatches.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-3 border-b border-[#EDF0F5] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#F5F7FC]"><span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-[#354055]">{product.name}</span><span className="mt-0.5 block text-[10px] text-[#8992A1]">{product.brand ?? 'Unbranded'} · {product.sku}</span></span><span className="shrink-0 text-right"><span className="block text-[10px] font-semibold text-[#1B449C]">ETB {money.format(product.sellingCents / 100)}</span><span className={`mt-0.5 block text-[9px] ${product.quantityOnHand > 0 ? 'text-[#667187]' : 'text-[#B82A1D]'}`}>{product.quantityOnHand} in stock</span></span></button>) : <p className="px-3 py-3 text-[11px] text-[#7C8493]">No matching products.</p>}
              </div>}
            </label>

            {lines.map((line, index) => {
              const product = productMap.get(line.productId)
              return <div key={index} className="grid grid-cols-1 gap-3 rounded-md border border-[#EDF0F5] p-3 sm:grid-cols-[minmax(0,1.5fr)_150px_40px]">
                <Field label="Product"><select required value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value, quantity: Number.isFinite(line.quantity) ? line.quantity : 1 })}><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id} disabled={lines.some((other, otherIndex) => otherIndex !== index && other.productId === item.id)}>{item.name} · {item.sku} · {item.quantityOnHand} in stock</option>)}</select></Field>
                <Field label="Quantity"><input type="number" min={1} max={product ? product.quantityOnHand : 1000} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></Field>
                <button type="button" onClick={() => removeLine(index)} aria-label="Remove line" className="flex h-10 items-center justify-center rounded-md text-[#8992A1] hover:bg-[#FCF0EE] hover:text-[#B82A1D]"><Trash2 size={15} /></button>
              </div>
            })}

            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <Field label="Payment method"><select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value as PaymentMethod); setSaleIdempotencyKey(crypto.randomUUID()) }}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field>
              <div className="flex items-end">
                <div className="w-full rounded-md border border-[#E3E7EF] bg-[#F9FAFC] px-3 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-[0.7px] text-[#8992A1]">Total</p>
                  <p className="mt-1 text-[22px] font-bold text-[#202638]">{money.format(subtotal / 100)} ETB</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2"><button disabled={saving || loading || !currentShift} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white hover:bg-[#163981] disabled:opacity-60"><ShoppingCart size={15} />{saving ? 'Processing…' : 'Complete sale'}</button></div>
          </form>

          <aside className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
            <div className="mb-4 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><ArrowUpRight size={16} /></span><h2 className="text-[14px] font-semibold">Recent sales</h2></div>
            {sales.length === 0 ? <p className="text-[12px] text-[#7C8493]">No sales recorded yet.</p> : <div className="space-y-3">{sales.slice(0, 6).map((sale) => <div key={sale.id} className={`rounded-md border p-3 ${sale.status === 'VOIDED' ? 'border-[#F1D0CB] bg-[#FCF7F6]' : 'border-[#EDF0F5]'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-semibold text-[#354055]">{sale.cashier.name}{sale.status === 'VOIDED' && <span className="ml-2 rounded bg-[#FCE4E1] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#B82A1D]">Voided</span>}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sale.createdAt))}</p></div><span className={`text-[11px] font-semibold ${sale.status === 'VOIDED' ? 'text-[#B82A1D] line-through' : 'text-[#1B449C]'}`}>{money.format(sale.totalCents / 100)} ETB</span></div><div className="mt-2 space-y-1">{sale.items.slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between text-[10px] text-[#667187]"><span>{item.product.name}</span><span>{item.quantity} × {money.format(item.unitPriceCents / 100)}</span></div>)}</div>{sale.status === 'VOIDED' ? sale.voidReason && <p className="mt-2 text-[10px] text-[#B82A1D]">Reason: {sale.voidReason}</p> : <div className="mt-2.5 flex items-center gap-3 text-[10px] font-semibold"><button type="button" onClick={() => receipt.print(sale)} className="inline-flex items-center gap-1 text-[#1B449C] hover:underline"><Printer size={12} />Receipt</button>{canVoid && <button type="button" onClick={() => { setVoidingId(voidingId === sale.id ? null : sale.id); setVoidReason('') }} className="inline-flex items-center gap-1 text-[#B82A1D] hover:underline"><Ban size={12} />Void</button>}</div>}{voidingId === sale.id && <div className="mt-2.5 space-y-2"><input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={300} placeholder="Reason for void (required)" className="h-9 w-full rounded-md border border-[#DDE2EC] px-2.5 text-[11px] outline-none focus:border-[#B82A1D]" /><button type="button" disabled={voidReason.trim().length < 3} onClick={() => void confirmVoid(sale.id)} className="h-8 rounded-md bg-[#B82A1D] px-3 text-[10px] font-semibold text-white disabled:opacity-50">Confirm void</button></div>}</div>)}</div>}
          </aside>
        </div>
      </div>
      {receipt.node}
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[#DDE2EC] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:outline-none [&_select]:focus:border-[#1B449C] [&_select]:focus:ring-2 [&_select]:focus:ring-[#E6ECF9]">{children}</span></label>
}
