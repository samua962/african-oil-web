import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ChevronRight,
  Clock3,
  ClipboardList,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Truck,
  UsersRound,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { useAuth } from './AuthContext'

const pageInfo: Record<string, { title: string; section: string }> = {
  '/': { title: 'Store overview', section: 'Operations' },
  '/sales': { title: 'Sales checkout', section: 'Cashier' },
  '/shifts': { title: 'Shift reconciliation', section: 'Cashier' },
  '/inventory': { title: 'Inventory', section: 'Catalog' },
  '/movements': { title: 'Stock movements', section: 'Inventory control' },
  '/users': { title: 'User management', section: 'Administration' },
  '/audit': { title: 'Audit log', section: 'Administration' },
  '/reports': { title: 'Reports', section: 'Insights' },
  '/purchasing': { title: 'Purchasing', section: 'Inventory control' },
  '/profile': { title: 'My profile', section: 'Account' },
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const currentPage = pageInfo[location.pathname] ?? pageInfo['/']

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    let active = true
    const checkApi = async () => {
      if (!navigator.onLine) {
        if (active) setApiOnline(false)
        return
      }
      try {
        const response = await fetch('/api/health', { signal: AbortSignal.timeout(4000) })
        if (active) setApiOnline(response.ok)
      } catch {
        if (active) setApiOnline(false)
      }
    }
    void checkApi()
    const interval = window.setInterval(checkApi, 20000)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  const linkClass = (active: boolean) => `flex h-10 items-center gap-3 rounded-md px-3 text-[12px] font-medium transition-colors ${active ? 'bg-[#EDF2FB] text-[#1B449C]' : 'text-[#59677D] hover:bg-[#F2F5FA] hover:text-[#26344E]'}`
  const navLinks = <>
    <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}><LayoutDashboard size={17} />Overview</NavLink>
    <NavLink to="/sales" className={({ isActive }) => linkClass(isActive)}><ShoppingCart size={17} />POS sales</NavLink>
    <NavLink to="/shifts" className={({ isActive }) => linkClass(isActive)}><Clock3 size={17} />Shift reconciliation</NavLink>
    <NavLink to="/inventory" className={({ isActive }) => linkClass(isActive)}><Package size={17} />Inventory</NavLink>
    {user?.role !== 'CASHIER' && <NavLink to="/movements" className={({ isActive }) => linkClass(isActive)}><Truck size={17} />Stock movements</NavLink>}
    {user?.role !== 'CASHIER' && <NavLink to="/purchasing" className={({ isActive }) => linkClass(isActive)}><ClipboardList size={17} />Purchasing</NavLink>}
    {user?.role !== 'CASHIER' && <NavLink to="/reports" className={({ isActive }) => linkClass(isActive)}><FileBarChart size={17} />Reports</NavLink>}
    {user?.role === 'ADMIN' && <NavLink to="/audit" className={({ isActive }) => linkClass(isActive)}><History size={17} />Audit log</NavLink>}
    {user?.role === 'ADMIN' && <NavLink to="/users" className={({ isActive }) => linkClass(isActive)}><UsersRound size={17} />Users</NavLink>}
  </>
  const connectionLabel = apiOnline === null ? 'Checking connection' : online && apiOnline ? 'Connected' : 'Connection unavailable'

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#202638]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#E4E8F0] bg-white transition-transform duration-200 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[68px] shrink-0 items-center border-b border-[#E8EBF2] px-4">
          <NavLink to="/" aria-label="African Oil store overview"><img src={africanOilLogo} alt="African Oil Ethiopia" className="h-auto w-[168px] object-contain" /></NavLink>
          <button onClick={() => setMenuOpen(false)} className="ml-auto flex size-8 items-center justify-center rounded-md text-[#667187] hover:bg-[#F2F5FA] lg:hidden" aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[1px] text-[#99A2B0]">Store</p>
          {navLinks}
          <div className="my-4 border-t border-[#EDF0F5]" />
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[1px] text-[#99A2B0]">Account</p>
          <NavLink to="/profile" className={({ isActive }) => linkClass(isActive)}><UserRound size={17} />My profile</NavLink>
        </nav>
        <div className="border-t border-[#E8EBF2] p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EDF2FB] text-[11px] font-bold text-[#1B449C]">{user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#354055]">{user?.name}</p><p className="truncate text-[10px] text-[#8992A1]">{user?.role.replaceAll('_', ' ').toLowerCase()}</p></div>
            <button onClick={() => void logout()} title="Sign out" aria-label="Sign out" className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#69758A] hover:bg-[#FCF0EE] hover:text-[#B82A1D]"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="fixed inset-0 z-30 bg-[#172035]/35 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" />}

      <div className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#E4E8F0] bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#52627A] hover:bg-[#F2F5FA] lg:hidden" aria-label="Open navigation"><Menu size={19} /></button>
            <div className="min-w-0"><p className="hidden text-[10px] font-medium uppercase tracking-[0.8px] text-[#8992A1] sm:block">{currentPage.section}</p><div className="flex items-center gap-2"><p aria-current="page" className="truncate text-[15px] font-semibold text-[#202638]">{currentPage.title}</p><ChevronRight size={14} className="hidden text-[#B5BDCA] sm:block" /><span className="hidden text-[11px] text-[#8992A1] sm:block">Station 01</span></div></div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <div className={`flex items-center gap-1.5 text-[10px] font-medium ${online && apiOnline ? 'text-[#1B449C]' : 'text-[#B82A1D]'}`} title={connectionLabel}>
              {online && apiOnline ? <Wifi size={14} /> : <WifiOff size={14} />}<span className="hidden sm:inline">{connectionLabel}</span>
            </div>
            <div className="h-5 w-px bg-[#E4E8F0]" /><span className="text-[10px] text-[#667187]">ETB</span>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}