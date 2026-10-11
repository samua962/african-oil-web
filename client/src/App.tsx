import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Dashboard from './Dashboard'
import InventoryPage from './InventoryPage'
import LoginPage from './LoginPage'
import ProfilePage from './ProfilePage'
import SalesPage from './SalesPage'
import StockMovementsPage from './StockMovementsPage'
import UsersPage from './UsersPage'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F5F7FC] text-[13px] text-[#69758A]">Loading account…</main>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" replace />} />
      <Route path="/inventory" element={user ? <InventoryPage /> : <Navigate to="/login" replace />} />
      <Route path="/sales" element={user ? <SalesPage /> : <Navigate to="/login" replace />} />
      <Route path="/movements" element={user && user.role !== 'CASHIER' ? <StockMovementsPage /> : <Navigate to="/" replace />} />
      <Route path="/users" element={user?.role === 'ADMIN' ? <UsersPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
