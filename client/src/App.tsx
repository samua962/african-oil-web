import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import AppShell from './AppShell'
import AuditPage from './AuditPage'
import Dashboard from './Dashboard'
import InventoryPage from './InventoryPage'
import LoginPage from './LoginPage'
import ProfilePage from './ProfilePage'
import PurchasingPage from './PurchasingPage'
import ReportsPage from './ReportsPage'
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './RecoveryPages'
import SalesPage from './SalesPage'
import ShiftPage from './ShiftPage'
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route element={user ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="shifts" element={<ShiftPage />} />
        <Route path="movements" element={user?.role !== 'CASHIER' ? <StockMovementsPage /> : <Navigate to="/" replace />} />
        <Route path="users" element={user?.role === 'ADMIN' ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="audit" element={user?.role === 'ADMIN' ? <AuditPage /> : <Navigate to="/" replace />} />
        <Route path="reports" element={user?.role !== 'CASHIER' ? <ReportsPage /> : <Navigate to="/" replace />} />
        <Route path="purchasing" element={user?.role !== 'CASHIER' ? <PurchasingPage /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
