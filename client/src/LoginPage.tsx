import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound, Wifi, WifiOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import { getPublicPreview, type PublicPreview } from './api/publicPreview'
import { productCategoryLabels } from './api/products'

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [sampleTab, setSampleTab] = useState<SampleTab>('stock')
  const [publicPreview, setPublicPreview] = useState<PublicPreview | null>(null)
  const [previewUnavailable, setPreviewUnavailable] = useState(false)
  const formProgress = (username.trim() ? 50 : 0) + (password ? 50 : 0)
  const hour = new Date().getHours()
  const greeting = t(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const gaugeMessage = t(formProgress === 100 ? 'Jug full. Ready to go.' : formProgress === 50 ? 'Half full. Add your password.' : 'Empty jug. Enter your username.')

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    let active = true
    getPublicPreview()
      .then((preview) => { if (active) setPublicPreview(preview) })
      .catch(() => { if (active) setPreviewUnavailable(true) })
    return () => { active = false }
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
        <div className="relative z-10 max-w-[470px] pb-16">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[1.4px] text-white/70">Ethiopia · ETB</p>
          <h2 className="text-[38px] font-bold leading-[1.12]">{t('Every litre counted.')}<br /><span className="text-[#FFC83D]">{t('Every shift on track.')}</span></h2>
          <p className="mt-4 max-w-[380px] text-[14px] leading-6 text-white/75">{t('Stock levels, oil sales and shift reports, all in one place.')}</p>
          <div className="mt-8 max-w-[300px]"><FuelGauge progress={formProgress} message={gaugeMessage} /></div>
          <div className="mt-5 max-w-[500px]"><LoginSamplePreview activeTab={sampleTab} onTabChange={setSampleTab} t={t} data={publicPreview} unavailable={previewUnavailable} /></div>
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
            <div className="flex flex-col items-end gap-2"><div className="flex items-center gap-2"><LanguageSwitcher compact /><ThemeSwitcher /></div><span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${online ? 'text-[#1B449C]' : 'text-[#B82A1D]'}`}>
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}{t(online ? 'Online' : 'Offline')}
            </span></div>
          </div>
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">{t('Staff sign-in')}</p>
              <h1 className="mt-2 text-[29px] font-bold leading-tight text-[#202638]">{greeting}{username.trim() ? `, ${username.trim()}` : ''}</h1>
              <p className="mt-2 text-[13px] text-[#7C8493]">{t('Sign in with your station account.')}</p>
            </div>
          </div>

          <div className="mb-5 lg:hidden"><FuelGauge progress={formProgress} message={gaugeMessage} compact /></div>

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
                onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
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
            {capsLockOn && <span role="status" className="mt-1.5 block text-[11px] font-semibold text-[#B56A00]">{t('Caps Lock is on')}</span>}
          </label>

          {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3.5 py-3 text-[12px] leading-5 text-[#A72419]"><span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[#B82A1D]" />{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={`relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(27,68,156,0.18)] transition focus:outline-none focus:ring-2 focus:ring-[#9CB1E0] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${formProgress === 100 ? 'bg-[#B82A1D] hover:bg-[#982319]' : 'bg-[#1B449C] hover:bg-[#163981]'}`}
          >
            <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-black/10 transition-[width] duration-700" style={{ width: `${formProgress}%` }} />
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            <span className="relative">{submitting ? t('Signing in…') : t('Sign in')}</span>
          </button>
          </form>

          <details className="mt-5 rounded-md border border-[#E3E7EF] bg-[#F9FAFD] px-3 py-2.5 lg:hidden">
            <summary className="cursor-pointer list-none text-[11px] font-semibold text-[#1B449C]">{t('View live store summary')}</summary>
            <div className="pt-3"><LoginSamplePreview activeTab={sampleTab} onTabChange={setSampleTab} t={t} data={publicPreview} unavailable={previewUnavailable} compact /></div>
          </details>

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

type SampleTab = 'stock' | 'sales' | 'team'

function LoginSamplePreview({ activeTab, onTabChange, t, data, unavailable, compact = false }: { activeTab: SampleTab; onTabChange: (tab: SampleTab) => void; t: (text: string) => string; data: PublicPreview | null; unavailable: boolean; compact?: boolean }) {
  const tabs: { id: SampleTab; label: string }[] = [
    { id: 'stock', label: 'Stock' },
    { id: 'sales', label: 'Sales' },
    { id: 'team', label: 'Team' },
  ]

  return (
    <section aria-label={t('Live store summary')} className={`rounded-lg border p-3.5 sm:p-4 ${compact ? 'border-[#E3E7EF] bg-white' : 'border-white/15 bg-white/[0.07]'}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label={t('Sample report sections')}>
          {tabs.map((tab) => <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded px-2.5 py-1.5 text-[10px] font-semibold transition ${activeTab === tab.id ? 'bg-white text-[#1B449C]' : compact ? 'text-[#667187] hover:bg-[#F2F5FA]' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >{t(tab.label)}</button>)}
        </div>
        {!compact && <span className="shrink-0 rounded-full border border-white/20 px-2 py-1 text-[9px] font-medium text-white/70">{t('Live summary')}</span>}
      </div>

      {activeTab === 'stock' && <div role="tabpanel" className="space-y-2.5">
        <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-[10px] font-semibold uppercase tracking-wide ${compact ? 'text-[#8992A1]' : 'text-white/55'}`}><span>{t('Category')}</span><span>{t('Status')}</span></div>
        {unavailable ? <p className={`py-3 text-[11px] ${compact ? 'text-[#7C8493]' : 'text-white/65'}`}>{t('Live preview is unavailable.')}</p> : data ? data.stock.map((item) => <div key={item.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-[10px]">
          <span className={`truncate font-medium ${compact ? 'text-[#354055]' : 'text-white/90'}`}>{t(productCategoryLabels[item.category])}</span>
          <span className={`font-semibold ${item.status === 'REORDER' || item.status === 'OUT_OF_STOCK' ? 'text-[#FFC83D]' : compact ? 'text-[#354055]' : 'text-white/90'}`}>{t(item.status)}</span>
        </div>) : <p className={`py-3 text-[11px] ${compact ? 'text-[#7C8493]' : 'text-white/65'}`}>{t('Loading live summary…')}</p>}
      </div>}

      {activeTab === 'sales' && <div role="tabpanel" className="grid grid-cols-2 gap-3">
        <div className={`col-span-2 rounded-md p-3 ${compact ? 'bg-[#F3F5F9]' : 'bg-white/5'}`}>
          <p className={`text-[9px] uppercase tracking-wide ${compact ? 'text-[#8992A1]' : 'text-white/55'}`}>{t('Sales activity today')}</p>
          {unavailable ? <p className={`mt-2 text-[11px] ${compact ? 'text-[#7C8493]' : 'text-white/65'}`}>{t('Live preview is unavailable.')}</p> : data ? <><p className={`mt-1 text-[15px] font-bold ${compact ? 'text-[#202638]' : 'text-white'}`}>{t(data.sales.hasSalesToday ? 'Sales recorded today' : 'No sales recorded today')}</p><p className={`mt-1 text-[10px] ${compact ? 'text-[#7C8493]' : 'text-white/60'}`}>{data.sales.activeDaysThisWeek} {t('of 7 days with sales this week')}</p></> : <p className={`mt-2 text-[11px] ${compact ? 'text-[#7C8493]' : 'text-white/65'}`}>{t('Loading live summary…')}</p>}
        </div>
      </div>}

      {activeTab === 'team' && <div role="tabpanel" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <p className={`col-span-full text-[9px] uppercase tracking-wide ${compact ? 'text-[#8992A1]' : 'text-white/55'}`}>{t('System roles')}</p>
        {[
          ['Cashier', 'Sales and own shift'],
          ['Store manager', 'Stock, reports and purchasing'],
          ['Administrator', 'Users and access'],
        ].map(([role, duties]) => <div key={role} className={`rounded-md px-3 py-2 ${compact ? 'bg-[#F3F5F9]' : 'bg-white/5'}`}><p className={`text-[10px] font-semibold ${compact ? 'text-[#202638]' : 'text-white'}`}>{t(role)}</p><p className={`mt-1 text-[9px] leading-4 ${compact ? 'text-[#7C8493]' : 'text-white/65'}`}>{t(duties)}</p></div>)}
      </div>}
    </section>
  )
}

function FuelGauge({ progress, message, compact = false }: { progress: number; message: string; compact?: boolean }) {
  const jugPath = 'M80 40 H112 L150 58 Q158 62 158 74 V176 Q158 192 142 192 H46 Q30 192 30 176 V88 Q30 72 44 66 L80 44 Z'
  const handlePath = 'M150 56 H174 Q196 56 196 78 V114 Q196 136 174 136 H150 Z M158 72 H172 Q182 72 182 82 V110 Q182 120 172 120 H158 Z'
  const liquidOffset = ((100 - progress) / 100) * 140 - 4
  const gradientId = compact ? 'jug-oil-compact' : 'jug-oil-desktop'
  const clipId = compact ? 'jug-body-compact' : 'jug-body-desktop'
  return (
    <figure aria-label={message} aria-live="polite" className={`m-0 ${compact ? 'flex items-center gap-3 rounded-md border border-[#E3E7EF] bg-[#F9FAFD] px-3 py-2' : ''}`}>
      <svg viewBox="0 -20 200 220" role="img" aria-label={`${progress}%`} className={`${compact ? 'w-[108px] shrink-0' : 'w-full max-w-[190px]'} overflow-visible`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD25A" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
          <clipPath id={clipId}><path d={jugPath} /></clipPath>
        </defs>
        <path d={handlePath} fillRule="evenodd" fill={compact ? 'rgba(27,68,156,.06)' : 'rgba(255,255,255,.12)'} stroke={compact ? '#AAB8CC' : 'rgba(255,255,255,.72)'} strokeWidth="3" />
        <path d={jugPath} fill={compact ? '#DCE8F6' : 'rgba(255,255,255,.08)'} />
        <g clipPath={`url(#${clipId})`}>
          <g className="jug-liquid" style={{ transform: `translateY(${liquidOffset}px)` }}>
            <g className="jug-wave">
              <path d="M0 70 Q20 62 40 70 T80 70 T120 70 T160 70 T200 70 T240 70 T280 70 T320 70 V240 H0 Z" fill={`url(#${gradientId})`} />
            </g>
          </g>
        </g>
        <path d={jugPath} fill="none" stroke={compact ? '#7184A0' : 'rgba(255,255,255,.78)'} strokeWidth="3" />
        {[100, 124, 148, 172].map((y) => <line key={y} x1="32" y1={y} x2="40" y2={y} stroke={compact ? '#7184A0' : 'rgba(255,255,255,.5)'} strokeWidth="2" strokeLinecap="round" />)}
        <rect x="78" y="22" width="34" height="7" rx="3" fill="#E2E8F0" />
        <rect x="76" y="2" width="38" height="21" rx="4" fill="#22C55E" />
        {[84, 90, 96, 102, 108].map((x) => <line key={x} x1={x} y1="6" x2={x} y2="19" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />)}
        <rect x="40" y="92" width="6" height="64" rx="3" fill="#fff" opacity=".22" />
        <rect x="50" y="100" width="88" height="58" rx="8" fill="#fff" opacity=".95" />
        <text x="94" y="117" textAnchor="middle" fill="#0A1450" fontSize="8" fontWeight="800" letterSpacing=".5">AFRICAN OIL</text>
        <text x="94" y="129" textAnchor="middle" fill="#53608F" fontSize="6" fontWeight="700" letterSpacing="1">MOTOR OIL</text>
        <text x="94" y="149" textAnchor="middle" fill="#B82A1D" fontSize="16" fontWeight="800">{progress}%</text>
        {progress > 0 && <circle key={progress} cx="95" cy="-8" r="5" fill="#FFC83D" className="jug-drop" />}
      </svg>
      <figcaption className={`${compact ? 'text-[10px] leading-4 text-[#667187]' : 'mt-1 min-h-6 text-[12px] font-semibold text-white/90'}`}>{message}</figcaption>
    </figure>
  )
}