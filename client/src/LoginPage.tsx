import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound, Wifi, WifiOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(!navigator.onLine || cause instanceof TypeError
        ? 'Unable to reach the sign-in service. Check your connection and try again.'
        : cause instanceof Error ? cause.message : 'Unable to sign in. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(360px,0.92fr)_1.08fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#1B449C] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="relative z-10 max-w-[430px] pb-24">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[1.4px] text-white/70">Ethiopia · ETB</p>
          <h2 className="text-[38px] font-bold leading-[1.12]">{t('Store operations')}<br />{t('start here.')}</h2>
          <p className="mt-5 max-w-[340px] text-[14px] leading-6 text-white/75">{t('Secure access for African Oil retail teams.')}</p>
        </div>
        <div className="absolute bottom-0 right-0 h-[210px] w-[250px] border-l border-t border-white/15" aria-hidden="true">
          <div className="absolute bottom-0 right-0 h-[104px] w-[104px] bg-[#B82A1D]" />
          <div className="absolute bottom-[104px] right-0 h-3 w-[176px] bg-[#E38505]" />
          <div className="absolute bottom-[116px] right-0 h-[94px] w-[74px] border-l border-t border-white/20" />
        </div>
        <p className="relative z-10 text-[10px] text-white/60">{t('AFRICAN OIL · RETAIL SYSTEM')}</p>
      </aside>

      <section className="flex min-h-screen items-center justify-center bg-[#F5F7FC] px-5 py-8 sm:px-10 lg:px-12 lg:py-4 xl:px-16">
        <div className="w-full max-w-[440px] rounded-lg border border-[#E3E7EF] bg-white px-6 py-7 shadow-[0_18px_50px_rgba(27,68,156,0.09)] sm:px-9 sm:py-9">
          <div className="mb-8 flex items-center justify-between gap-3 border-b border-[#E9EDF4] pb-5">
            <img src={africanOilLogo} alt="African Oil Ethiopia" className="h-auto w-[178px] object-contain sm:w-[194px]" />
            <div className="flex flex-col items-end gap-2"><LanguageSwitcher compact /><span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${online ? 'text-[#1B449C]' : 'text-[#B82A1D]'}`}>
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}{t(online ? 'Online' : 'Offline')}
            </span></div>
          </div>
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Staff sign-in')}</p>
              <h1 className="mt-2 text-[29px] font-bold leading-tight text-[#202638]">{t('Welcome back')}</h1>
              <p className="mt-2 text-[13px] text-[#7C8493]">{t('Sign in with your station account.')}</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#354055]">{t('Username')}</span>
            <span className="relative block">
              <UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B94A5]" />
              <input
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={80}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t('Username')}
                className="h-12 w-full rounded-md border border-[#D8DEEA] bg-white pl-11 pr-3 text-[13px] text-[#202638] outline-none transition placeholder:text-[#A0A7B4] hover:border-[#A9B6D0] focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#354055]">
              {t('Password')}
              <Link to="/forgot-password" className="font-medium text-[#1B449C] hover:underline">{t('Forgot password?')}</Link>
            </span>
            <span className="relative block">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B94A5]" />
              <input
                autoComplete="current-password"
                required
                maxLength={200}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('Password')}
                className="h-12 w-full rounded-md border border-[#D8DEEA] bg-white pl-11 pr-12 text-[13px] text-[#202638] outline-none transition placeholder:text-[#A0A7B4] hover:border-[#A9B6D0] focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded text-[#69758A] transition hover:bg-[#F3F5F9] hover:text-[#1B449C] focus:outline-none focus:ring-2 focus:ring-[#9CB1E0]"
                aria-label={t(showPassword ? 'Hide password' : 'Show password')}
                title={t(showPassword ? 'Hide password' : 'Show password')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3.5 py-3 text-[12px] leading-5 text-[#A72419]"><span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[#B82A1D]" />{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#1B449C] px-4 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(27,68,156,0.18)] transition hover:bg-[#163981] focus:outline-none focus:ring-2 focus:ring-[#9CB1E0] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            {submitting ? t('Signing in…') : t('Sign in')}
          </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#7C8493]">{t('No account? Contact your administrator.')}</p>

          <div className="mt-8 flex items-center justify-between border-t border-[#E9EDF4] pt-4 text-[10px] text-[#8C94A2]">
            <span>{t('Secure station access')}</span>
            <span>ETB · Ethiopia</span>
          </div>
        </div>
      </section>
    </main>
  )
}