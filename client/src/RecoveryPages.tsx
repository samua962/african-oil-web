import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, LoaderCircle, Mail, LockKeyhole } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { postRecovery } from './api/recovery'
import { useLanguage } from './LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'

const inputClass = 'h-12 w-full rounded-md border border-[#D8DEEA] bg-white pl-11 pr-3 text-[13px] text-[#202638] outline-none transition placeholder:text-[#A0A7B4] hover:border-[#A9B6D0] focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]'
const buttonClass = 'flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#1B449C] px-4 text-[13px] font-semibold text-white transition hover:bg-[#163981] focus:outline-none focus:ring-2 focus:ring-[#9CB1E0] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70'

// Shared card layout for the public account-recovery screens.
function RecoveryCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useLanguage()
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FC] px-5 py-8">
      <div className="w-full max-w-[440px] rounded-lg border border-[#E3E7EF] bg-white px-6 py-8 shadow-[0_18px_50px_rgba(27,68,156,0.09)] sm:px-9">
        <div className="mb-6 flex items-start justify-between gap-3"><img src={africanOilLogo} alt="African Oil Ethiopia" className="h-auto w-[178px] object-contain" /><LanguageSwitcher compact /></div>
        <h1 className="text-[24px] font-bold leading-tight text-[#202638]">{t(title)}</h1>
        <p className="mt-2 mb-6 text-[13px] leading-5 text-[#7C8493]">{t(subtitle)}</p>
        {children}
        <p className="mt-6 text-center text-[12px]"><Link to="/login" className="font-medium text-[#1B449C] hover:underline">{t('Back to sign in')}</Link></p>
      </div>
    </main>
  )
}

const ErrorAlert = ({ message }: { message: string }) => (
  <p role="alert" className="rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3.5 py-3 text-[12px] leading-5 text-[#A72419]">{message}</p>
)

const Notice = ({ message }: { message: string }) => (
  <p role="status" className="flex items-start gap-2 rounded-md border border-[#CFE3D6] bg-[#F0F8F3] px-3.5 py-3 text-[12px] leading-5 text-[#1E6B3A]"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{message}</p>
)

export function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setMessage(await postRecovery('forgot-password', { email }))
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Unable to reach the service. Check your connection.' : cause instanceof Error ? cause.message : 'Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RecoveryCard title="Forgot password?" subtitle="Enter the email on your account and we will send a reset link. No email on file? Ask your administrator to reset your password.">
      {message ? <Notice message={t(message)} /> : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#354055]">{t('Email')}</span>
            <span className="relative block">
              <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B94A5]" />
              <input type="email" required maxLength={200} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
            </span>
          </label>
          {error && <ErrorAlert message={t(error)} />}
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting && <LoaderCircle size={16} className="animate-spin" />}{t('Send reset link')}
          </button>
        </form>
      )}
    </RecoveryCard>
  )
}

export function ResetPasswordPage() {
  const { t } = useLanguage()
  const token = useSearchParams()[0].get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      setMessage(await postRecovery('reset-password', { token, password }))
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Unable to reach the service. Check your connection.' : cause instanceof Error ? cause.message : 'Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RecoveryCard title="Set a new password" subtitle="Use at least 12 characters. You will be signed out on all devices.">
      {!token ? <ErrorAlert message={t('This reset link is invalid. Request a new one.')} /> : message ? <Notice message={t(message)} /> : (
        <form onSubmit={submit} className="space-y-5">
          {[['New password', password, setPassword], ['Confirm password', confirm, setConfirm]].map(([label, value, setter]) => (
            <label key={label as string} className="block">
              <span className="mb-2 block text-[12px] font-semibold text-[#354055]">{t(label as string)}</span>
              <span className="relative block">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B94A5]" />
                <input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={value as string} onChange={(event) => (setter as (v: string) => void)(event.target.value)} className={inputClass} />
              </span>
            </label>
          ))}
          {error && <ErrorAlert message={t(error)} />}
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting && <LoaderCircle size={16} className="animate-spin" />}{t('Update password')}
          </button>
        </form>
      )}
    </RecoveryCard>
  )
}

export function VerifyEmailPage() {
  const { t } = useLanguage()
  const token = useSearchParams()[0].get('token') ?? ''
  const [state, setState] = useState<{ message?: string; error?: string }>({})
  const started = useRef(false)

  useEffect(() => {
    // Guard against double-invocation in StrictMode; the token is single-use.
    if (started.current || !token) return
    started.current = true
    postRecovery('verify-email', { token })
      .then((message) => setState({ message }))
      .catch((cause) => setState({ error: cause instanceof Error ? cause.message : 'Verification failed.' }))
  }, [token])

  const error = !token ? t('This verification link is invalid.') : state.error ? t(state.error) : undefined
  return (
    <RecoveryCard title="Email verification" subtitle="Confirming your email address.">
      {error ? <ErrorAlert message={error} /> : state.message ? <Notice message={t('Email verified. You can now reset your password by email.')} /> : <p className="flex items-center gap-2 text-[13px] text-[#7C8493]"><LoaderCircle size={16} className="animate-spin" />{t('Verifying…')}</p>}
    </RecoveryCard>
  )
}
