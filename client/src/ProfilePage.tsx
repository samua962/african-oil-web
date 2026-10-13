import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react'
import { useAuth } from './AuthContext'
import { updateProfile } from './api/profile'

export default function ProfilePage() {
  const { user, updateProfile: updateSession } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
    setUsername(user?.username ?? '')
  }, [user?.name, user?.username])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if ((currentPassword || newPassword || confirmPassword) && (!currentPassword || !newPassword || !confirmPassword)) {
      setError('Enter your current password and both new-password fields to change your password.')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (newPassword && newPassword.length < 12) {
      setError('Your new password must be at least 12 characters.')
      return
    }

    setSaving(true)
    try {
      const updatedUser = await updateProfile({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        ...(newPassword ? { currentPassword, newPassword } : {}),
      })
      updateSession(updatedUser)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Profile updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[760px] px-4 pb-12 pt-7 sm:px-7 lg:pt-10">
        <div className="mb-6"><p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">Account settings</p><h1 className="mt-1.5 text-[27px] font-bold">My profile</h1><p className="mt-1 text-[12px] text-[#7C8493]">Update your account details and sign-in password.</p></div>

        <form onSubmit={submit} className="space-y-4">
          <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><UserRound size={17} /></span><div><h2 className="text-[14px] font-semibold">Account details</h2><p className="mt-0.5 text-[11px] text-[#8992A1]">Your role is managed by an administrator.</p></div></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name"><input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <Field label="Username"><input required minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
              <Field label="Role"><input value={user?.role.replaceAll('_', ' ').toLowerCase() ?? ''} disabled /></Field>
            </div>
          </section>

          <section className="rounded-lg border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(25,43,77,0.035)] sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-[#FFF2DE] text-[#B56A00]"><LockKeyhole size={17} /></span><div><h2 className="text-[14px] font-semibold">Change password</h2><p className="mt-0.5 text-[11px] text-[#8992A1]">Leave these fields blank to keep your current password.</p></div></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Current password"><input autoComplete="current-password" type="password" maxLength={200} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field></div>
              <Field label="New password"><input autoComplete="new-password" type="password" minLength={12} maxLength={200} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
              <Field label="Confirm new password"><input autoComplete="new-password" type="password" minLength={12} maxLength={200} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
            </div>
          </section>

          {error && <p role="alert" className="rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3 py-2.5 text-[12px] text-[#A72419]">{error}</p>}
          {success && <p role="status" className="inline-flex items-center gap-2 rounded-md border border-[#D7E4D9] bg-[#F2F8F2] px-3 py-2.5 text-[12px] text-[#326B45]"><CheckCircle2 size={15} />{success}</p>}
          <div className="flex justify-end"><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[12px] font-semibold text-white hover:bg-[#163981] disabled:cursor-wait disabled:opacity-60">{saving && <LoaderCircle size={15} className="animate-spin" />}Save changes</button></div>
        </form>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9] [&_input:disabled]:bg-[#F5F6F9] [&_input:disabled]:text-[#7C8493]">{children}</span></label>
}