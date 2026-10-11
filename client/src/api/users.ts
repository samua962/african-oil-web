import type { UserRole } from '../AuthContext'

export type ManagedUser = {
  id: string
  name: string
  username: string
  role: UserRole
  active: boolean
  createdAt: string
}

export type ManagedUserInput = {
  name: string
  username: string
  role: UserRole
  password?: string
  active?: boolean
}

type UserPayload = { user?: ManagedUser; users?: ManagedUser[]; error?: string }

async function request(path: string, init?: RequestInit): Promise<UserPayload> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const payload = await response.json().catch(() => ({})) as UserPayload
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.')
  return payload
}

export async function listUsers() {
  const payload = await request('/api/users')
  return payload.users ?? []
}

export async function createUser(user: ManagedUserInput) {
  return request('/api/users', { method: 'POST', body: JSON.stringify(user) })
}

export async function updateUser(id: string, user: Partial<ManagedUserInput>) {
  return request(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(user) })
}