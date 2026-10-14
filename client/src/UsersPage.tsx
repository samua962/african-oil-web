import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, Plus, Shield, UserRound, X } from 'lucide-react'
import { useAuth, type UserRole } from './AuthContext'
import { createUser, listUsers, resendVerification, updateUser, type ManagedUser, type ManagedUserInput } from './api/users'
import { useLanguage } from './LanguageContext'

const roles: { value: UserRole; label: string }[] = [
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'STORE_MANAGER', label: 'Store manager' },
  { value: 'ADMIN', label: 'Administrator' },
]

const emptyForm = (): ManagedUserInput => ({ name: '', username: '', email: '', role: 'CASHIER', password: '' })

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { t } = useLanguage()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<ManagedUserInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true
    listUsers()
      .then((result) => {
        if (!active) return
        setUsers(result)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load users.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refreshVersion])

  const beginCreate = () => {
    setEditingUser(null)
    setForm(emptyForm())
    setFormError('')
    setIsCreating(true)
  }

  const beginEdit = (managedUser: ManagedUser) => {
    setEditingUser(managedUser)
    setForm({ name: managedUser.name, username: managedUser.username, email: managedUser.email ?? '', role: managedUser.role, password: '' })
    setFormError('')
    setIsCreating(false)
  }

  const closeForm = () => {
    setEditingUser(null)
    setIsCreating(false)
    setFormError('')
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    const input = { ...form, name: form.name.trim(), username: form.username.trim().toLowerCase(), email: (form.email ?? '').trim() }
    if (!input.password) delete input.password

    try {
      if (editingUser) await updateUser(editingUser.id, input)
      else await createUser(input)
      closeForm()
      setLoading(true)
      setRefreshVersion((version) => version + 1)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save user.')
    } finally {
      setSaving(false)
    }
  }

  const sendVerification = async (id: string) => {
    setFormError('')
    try {
      await resendVerification(id)
      setFormError('Verification email sent.')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not send verification email.')
    }
  }

  const toggleActive = async (managedUser: ManagedUser) => {
    setSavingUserId(managedUser.id)
    setError('')
    try {
      await updateUser(managedUser.id, { active: !managedUser.active })
      setRefreshVersion((version) => version + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update account status.')
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#F5F7FC] text-[#202638]">
      <div className="mx-auto max-w-[1100px] px-4 pb-10 pt-7 sm:px-7 lg:px-10 lg:pt-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Administration')}</p><h1 className="mt-1.5 text-[27px] font-bold">{t('User management')}</h1><p className="mt-1 text-[12px] text-[#7C8493]">{t('Manage station access and account roles.')}</p></div>
          <button onClick={beginCreate} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[12px] font-semibold text-white hover:bg-[#163981]"><Plus size={16} /> {t('Add user')}</button>
        </div>

        <section className="overflow-hidden rounded-lg border border-[#E3E7EF] bg-white shadow-[0_2px_8px_rgba(25,43,77,0.035)]">
          <div className="flex items-center justify-between border-b border-[#EDF0F5] px-5 py-4"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-md bg-[#EDF2FB] text-[#1B449C]"><Shield size={16} /></span><span className="text-[12px] font-semibold text-[#3E485B]">{t('Station accounts')}</span></div><span className="text-[11px] text-[#828C9D]">{users.length} {t('users')}</span></div>
          {error && <p role="alert" className="border-b border-[#F1D0CB] bg-[#FCF0EE] px-5 py-3 text-[12px] text-[#A72419]">{error}</p>}
          {loading ? <div className="flex h-48 items-center justify-center gap-2 text-[12px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" /> Loading users</div> : users.length === 0 ? <div className="px-5 py-12 text-center text-[12px] text-[#7C8493]">No accounts found.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[690px] border-collapse text-left">
              <thead><tr className="bg-[#F9FAFC] text-[10px] font-semibold uppercase tracking-[0.6px] text-[#8992A1]"><th className="px-5 py-3">{t('Account')}</th><th className="px-3 py-3">{t('Role')}</th><th className="px-3 py-3">{t('Status')}</th><th className="px-3 py-3">{t('Created')}</th><th className="px-5 py-3 text-right">{t('Actions')}</th></tr></thead>
              <tbody className="divide-y divide-[#EDF0F5]">{users.map((managedUser) => {
                const isCurrent = managedUser.id === currentUser?.id
                const isBusy = savingUserId === managedUser.id
                return <tr key={managedUser.id} className="hover:bg-[#FCFCFE]"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#EDF2FB] text-[#1B449C]"><UserRound size={16} /></span><div><p className="text-[12px] font-semibold text-[#354055]">{managedUser.name}{isCurrent && <span className="ml-2 text-[10px] font-normal text-[#8C94A2]">{t('You')}</span>}</p><p className="mt-0.5 text-[10px] text-[#929BAC]">@{managedUser.username}</p></div></div></td><td className="px-3 py-3.5"><span className="rounded bg-[#F1F3F8] px-2 py-1 text-[10px] font-medium text-[#526078]">{t(roles.find((role) => role.value === managedUser.role)?.label ?? '')}</span></td><td className="px-3 py-3.5"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${managedUser.active ? 'text-[#1B449C]' : 'text-[#8992A1]'}`}><span className={`size-1.5 rounded-full ${managedUser.active ? 'bg-[#1B449C]' : 'bg-[#A7AFBD]'}`} />{managedUser.active ? t('Active') : t('Inactive')}</span></td><td className="px-3 py-3.5 text-[11px] text-[#778296]">{new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium' }).format(new Date(managedUser.createdAt))}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-2"><button onClick={() => beginEdit(managedUser)} className="h-8 rounded-md border border-[#DDE2EC] px-2.5 text-[10px] font-semibold text-[#1B449C] hover:bg-[#F3F6FC]">{t('Edit')}</button><button disabled={isCurrent || isBusy} onClick={() => void toggleActive(managedUser)} className={`h-8 rounded-md border px-2.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${managedUser.active ? 'border-[#F1D0CB] text-[#B82A1D] hover:bg-[#FCF0EE]' : 'border-[#D7E4D9] text-[#326B45] hover:bg-[#F2F8F2]'}`}>{isBusy ? t('Saving…') : managedUser.active ? t('Deactivate') : t('Activate')}</button></div></td></tr>
              })}</tbody>
            </table></div>
          )}
          <div className="border-t border-[#EDF0F5] px-5 py-3 text-[10px] text-[#8C94A2]">At least one active administrator must remain. Your own account cannot be deactivated here.</div>
        </section>
      </div>

      {(isCreating || editingUser !== null) && <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#172035]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="user-form-title" className="text-[19px] font-bold">{t(editingUser ? 'Edit user' : 'Add user')}</h2><p className="mt-1 text-[11px] text-[#7C8493]">{t('Assign a role for station access.')}</p></div><button onClick={closeForm} aria-label={t('Close')} className="flex size-8 items-center justify-center rounded text-[#7C8493] hover:bg-[#F3F5F9]"><X size={17} /></button></div>
          <form onSubmit={save} className="space-y-4">
            <Field label={t('Full name')}><input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t('Name')} /></Field>
            <Field label={t('Username')}><input required minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" autoCapitalize="none" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="e.g. abel.cashier" /></Field>
            <Field label={t('Email (for password reset)')}><input type="email" maxLength={200} value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></Field>
            {editingUser?.email && editingUser.email === form.email && (
              <p className="-mt-2 flex items-center justify-between gap-2 text-[11px]">
                {editingUser.emailVerifiedAt ? <span className="text-[#1E6B3A]">Email verified</span> : <><span className="text-[#B82A1D]">Not verified: reset links are disabled</span><button type="button" className="font-semibold text-[#1B449C] hover:underline" onClick={() => sendVerification(editingUser.id)}>Resend verification</button></>}
              </p>
            )}
            <Field label={t('Role')}><select disabled={editingUser?.id === currentUser?.id} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>{roles.map((role) => <option key={role.value} value={role.value}>{t(role.label)}</option>)}</select></Field>
            {editingUser?.id === currentUser?.id && <p className="-mt-2 text-[10px] text-[#8C94A2]">Your own administrator role cannot be changed.</p>}
            <Field label={editingUser ? 'New password (leave blank to keep current)' : 'Temporary password (minimum 12 characters)'}><input required={!editingUser} minLength={12} maxLength={200} autoComplete="new-password" type="password" value={form.password ?? ''} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingUser ? 'Leave blank to keep current' : 'Set initial password'} /></Field>
            {formError && <p role="alert" className="rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3 py-2 text-[11px] text-[#A72419]">{formError}</p>}
            <p className="text-[10px] text-[#8C94A2]">Share temporary passwords with the account holder securely. Passwords are stored as hashes.</p>
            <div className="flex justify-end gap-2 border-t border-[#EDF0F5] pt-4"><button type="button" onClick={closeForm} className="h-9 rounded-md border border-[#DDE2EC] px-3 text-[11px] font-semibold text-[#58647A]">Cancel</button><button disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1B449C] px-4 text-[11px] font-semibold text-white hover:bg-[#163981] disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}{editingUser ? 'Save user' : 'Create user'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#3E485B]">{label}</span><span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#DDE2EC] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:outline-none [&_input]:focus:border-[#1B449C] [&_input]:focus:ring-2 [&_input]:focus:ring-[#E6ECF9] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[#DDE2EC] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:outline-none [&_select]:focus:border-[#1B449C] [&_select]:focus:ring-2 [&_select]:focus:ring-[#E6ECF9]">{children}</span></label>
}