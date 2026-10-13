import type { ClosedShift } from './api/shifts'
import type { Sale } from './api/sales'

const money = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })
const methodNames = { CASH: 'Cash', TELEBIRR: 'Telebirr', CBE_BIRR: 'CBE Birr', CARD: 'Card' } as const

// Narrow thermal-printer layout.
export function ReceiptView({ sale }: { sale: Sale }) {
  return (
    <div className="receipt">
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, margin: 0 }}>AFRICAN OIL ETHIOPIA</p>
      <p style={{ textAlign: 'center', margin: '2px 0 8px' }}>Retail store receipt</p>
      <p style={{ margin: 0 }}>Receipt: {sale.id.slice(0, 8).toUpperCase()}</p>
      <p style={{ margin: 0 }}>Date: {dateTime.format(new Date(sale.createdAt))}</p>
      <p style={{ margin: '0 0 6px' }}>Cashier: {sale.cashier.name}</p>
      <hr style={{ border: 0, borderTop: '1px dashed #000' }} />
      {sale.items.map((item) => (
        <div key={item.id} style={{ marginBottom: 4 }}>
          <div>{item.product.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{item.quantity} x {money.format(item.unitPriceCents / 100)}</span>
            <span>{money.format(item.lineTotalCents / 100)}</span>
          </div>
        </div>
      ))}
      <hr style={{ border: 0, borderTop: '1px dashed #000' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
        <span>TOTAL (ETB)</span><span>{money.format(sale.totalCents / 100)}</span>
      </div>
      <p style={{ margin: '4px 0 0' }}>Paid by: {methodNames[sale.payment.method]}</p>
      <p style={{ textAlign: 'center', margin: '10px 0 0' }}>Thank you for shopping with us.</p>
    </div>
  )
}

export function ShiftReportView({ shift }: { shift: ClosedShift }) {
  const cell = { border: '1px solid #999', padding: '4px 8px', textAlign: 'left' as const, fontSize: 12 }
  const variances = shift.reconciliations.filter((line) => line.variance !== 0)
  return (
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif', padding: 24, maxWidth: 720 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>African Oil Ethiopia: Shift report</h1>
      <p style={{ margin: '4px 0 16px', fontSize: 12 }}>
        Opened {dateTime.format(new Date(shift.openedAt))} by {shift.openedBy.name}
        {shift.closedAt && <> · Closed {dateTime.format(new Date(shift.closedAt))} by {shift.closedBy?.name ?? 'n/a'}</>}
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>
        <tbody>
          <tr><th style={cell}>Sales</th><td style={cell}>{shift.saleCount} sales · ETB {money.format(shift.salesTotalCents / 100)}</td></tr>
          {(Object.keys(methodNames) as (keyof typeof methodNames)[]).map((method) => (
            <tr key={method}><th style={cell}>{methodNames[method]}</th><td style={cell}>ETB {money.format(shift.paymentTotals[method] / 100)}</td></tr>
          ))}
          <tr><th style={cell}>Opening float</th><td style={cell}>ETB {money.format(shift.openingFloatCents / 100)}</td></tr>
          <tr><th style={cell}>Expected cash</th><td style={cell}>ETB {money.format((shift.cashExpectedCents ?? 0) / 100)}</td></tr>
          <tr><th style={cell}>Counted cash</th><td style={cell}>ETB {money.format((shift.cashCountedCents ?? 0) / 100)}</td></tr>
          <tr><th style={cell}>Cash variance</th><td style={{ ...cell, fontWeight: 700 }}>ETB {money.format((shift.cashVarianceCents ?? 0) / 100)}</td></tr>
        </tbody>
      </table>
      <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Stock variances ({variances.length})</h2>
      {variances.length === 0 ? <p style={{ fontSize: 12 }}>No stock variances.</p> : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={cell}>SKU</th><th style={cell}>Product</th><th style={cell}>Expected</th><th style={cell}>Counted</th><th style={cell}>Variance</th></tr></thead>
          <tbody>{variances.map((line) => <tr key={line.product.sku}><td style={cell}>{line.product.sku}</td><td style={cell}>{line.product.name}</td><td style={cell}>{line.expectedQty}</td><td style={cell}>{line.physicalQty}</td><td style={cell}>{line.variance > 0 ? `+${line.variance}` : line.variance}</td></tr>)}</tbody>
        </table>
      )}
      <p style={{ marginTop: 32, fontSize: 12 }}>Cashier signature: ____________________ &nbsp;&nbsp; Manager signature: ____________________</p>
    </div>
  )
}
