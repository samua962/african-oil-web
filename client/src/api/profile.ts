import type { AuthUser } from '../AuthContext'

export type ProfileUpdate = {
  name: string
  username: string
  currentPassword?: string
  newPassword?: string
}

export async function updateProfile(profile: ProfileUpdate): Promise<AuthUser> {
  const response = await fetch('/api/auth/profile', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  const payload = await response.json().catch(() => ({})) as { user?: AuthUser; error?: string }
  if (!response.ok || !payload.user) throw new Error(payload.error ?? 'Could not update your profile.')
  return payload.user
}