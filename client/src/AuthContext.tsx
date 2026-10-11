import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type UserRole = 'CASHIER' | 'STORE_MANAGER' | 'ADMIN'

export type AuthUser = {
  id: string
  name: string
  username: string
  role: UserRole
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = await response.json() as { user: AuthUser }
        return payload.user
      })
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const payload = await response.json() as { user?: AuthUser; error?: string }
    if (!response.ok || !payload.user) {
      throw new Error(payload.error ?? 'Unable to sign in. Try again.')
    }
    setUser(payload.user)
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      setUser(null)
    }
  }

  const updateProfile = (updatedUser: AuthUser) => setUser(updatedUser)

  return <AuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}