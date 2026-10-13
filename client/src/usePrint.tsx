import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Renders printable content into a body-level portal, opens the print dialog, then removes it.
export function usePrint<T>(render: (data: T) => ReactNode) {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    if (data === null) return
    const done = () => setData(null)
    window.addEventListener('afterprint', done, { once: true })
    const timer = window.setTimeout(() => window.print(), 60)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
    }
  }, [data])

  const node = data === null ? null : createPortal(<div className="print-area">{render(data)}</div>, document.body)
  return { print: (value: T) => setData(value), node }
}
