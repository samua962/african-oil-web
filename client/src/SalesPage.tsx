import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { useAuth } from './AuthContext'
import { createSale, listSales, type PaymentMethod, type Sale } from './api/sales'
import { listProducts, type Product } from './api/products'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: 1 }])

  useEffect(() => {
    let active = true
    Promise.all([listProducts({ pageSize: 200 }), listSales()])
      .then(([productList, saleList]) => {
        if (!active) return
        setProducts(productList.products)
        setSales(saleList.sales)
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

  const addLine = () => setLines((current) => [...current, { productId: '', quantity: 1 }])
  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }
  const removeLine = (index: number) => {
    setLines((current) => current.length > 1 ? current.filter((_, lineIndex) => lineIndex !== index) : [{ productId: '', quantity: 1 }])
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
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
        idempotencyKey: crypto.randomUUID(),
        paymentMethod,
        items: validLines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      }
      const result = await createSale(payload)
      const nextSales = await listSales()
      setSales(nextSales.sales)
      setLines([{ productId: '', quantity: 1 }])
      setPaymentMethod('CASH')
      setMessage(result.replayed ? 'This sale was already processed; no duplicate was recorded.' : `Sale completed for ${money.format(result.sale.totalCents / 100)} ETB.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete sale.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F7FC] text-[#202638]">
      <header className="flex h-[68px] items-center justify-between border-b border-[#E4E8F0] bg-white px-4 sm:px-7 lg:px-10">
        <Link to="/" aria-label="Back to dashboard"><img src={africanOilLogo} alt="African Oil Ethiopia" className="h-auto w-[156px] object-contain" /></Link>
        <Link to="/" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#DDE2EC] px-3 text-[12px] font-semibold text-[#1B449C] hover:bg-[#F3F6FC]"><ArrowLeft size={14} /> Dashboard</Link>
      </header>

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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <form onSubmit={submit} className="space-y-4 rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-[14px] font-semibold">Sale items</h2><p className="mt-1 text-[11px] text-[#8992A1]">Current stock is checked before every sale.</p></div><button type="button" onClick={addLine} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE2EC] px-2.5 text-[10px] font-semibold text-[#1B449C] hover:bg-[#F3F6FC]"><Plus size={13} />Add item</button></div>

            {lines.map((line, index) => {
              const product = productMap.get(line.productId)
              return <div key={index} className="grid grid-cols-1 gap-3 rounded-md border border-[#EDF0F5] p-3 sm:grid-cols-[minmax(0,1.5fr)_150px_40px]">
                <Field label="Product"><select required value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value, quantity: Number.isFinite(line.quantity) ? line.quantity : 1 })}><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id} disabled={lines.some((other, otherIndex) => otherIndex !== index && other.productId === item.id)}>{item.name} · {item.sku} · {item.quantityOnHand} in stock</option>)}</select></Field>
                <Field label="Quantity"><input type="number" min={1} max={product ? product.quantityOnHand : 1000} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></Field>
                <button type="button" onClick={() => removeLine(index)} aria-label="Remove line" className="flex h-10 items-center justify-center rounded-md text-[#8992A1] hover:bg-[#FCF0EE] hover:text-[#B82A1D]"><Trash2 size={15} /></button>
              </div>
            })}

            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <Field label="Payment method"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field>
              <div className="flex items-end">
                <div className="w-full rounded-md border border-[#E3E7EF] bg-[#F9FAFC] px-3 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-[0.7px] text-[#8992A1]">Total</p>
                  <p className="mt-1 text-[22px] font-bold text-[#202638]">{money.format(subtotal / 100)} ETB</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2"><button disabled={saving || loading} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white hover:bg-[#163981] disabled:opacity-60"><ShoppingCart size={15} />{saving ? 'Processing…' : 'Complete sale'}</button></div>
          </form>

          <aside className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
            <div className="mb-4 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><ArrowUpRight size={16} /></span><h2 className="text-[14px] font-semibold">Recent sales</h2></div>
            {sales.length === 0 ? <p className="text-[12px] text-[#7C8493]">No sales recorded yet.</p> : <div className="space-y-3">{sales.slice(0, 6).map((sale) => <div key={sale.id} className="rounded-md border border-[#EDF0F5] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-semibold text-[#354055]">{sale.cashier.name}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">{new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sale.createdAt))}</p></div><span className="text-[11px] font-semibold text-[#1B449C]">{money.format(sale.totalCents / 100)} ETB</span></div><div className="mt-2 space-y-1">{sale.items.slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between text-[10px] text-[#667187]"><span>{item.product.name}</span><span>{item.quantity} × {money.format(item.unitPriceCents / 100)}</span></div>)}</div></div>)}</div>}
          </aside>
        </div>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[#DDE2EC] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:outline-none [&_select]:focus:border-[#1B449C] [&_select]:focus:ring-2 [&_select]:focus:ring-[#E6ECF9]">{children}</span></label>
}
