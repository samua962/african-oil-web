import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import africanOilLogo from '../asset/african_oil_ethiopia_logo.png'
import { useAuth } from './AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FC] px-4 py-10">
      <section className="w-full max-w-[420px] rounded-lg border border-[#E3E7EF] bg-white px-6 py-8 shadow-[0_12px_40px_rgba(27,68,156,0.08)] sm:px-9 sm:py-10">
        <div className="mb-8 flex justify-center">
          <img src={africanOilLogo} alt="African Oil Ethiopia" className="h-auto w-[220px] object-contain" />
        </div>
        <div className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#1B449C]">Retail operations</p>
          <h1 className="mt-2 text-[25px] font-bold text-[#202638]">Sign in</h1>
          <p className="mt-1.5 text-[13px] text-[#7C8493]">Use your station account to continue.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#3E485B]">Username</span>
            <span className="relative block">
              <UserRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B94A5]" />
              <input
                autoComplete="username"
                autoCapitalize="none"
                required
                maxLength={80}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                className="h-11 w-full rounded-md border border-[#DDE2EC] bg-white pl-10 pr-3 text-[13px] text-[#202638] outline-none transition focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9] placeholder:text-[#A0A7B4]"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#3E485B]">Password</span>
            <span className="relative block">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B94A5]" />
              <input
                autoComplete="current-password"
                required
                maxLength={200}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-11 w-full rounded-md border border-[#DDE2EC] bg-white pl-10 pr-11 text-[13px] text-[#202638] outline-none transition focus:border-[#1B449C] focus:ring-2 focus:ring-[#E6ECF9] placeholder:text-[#A0A7B4]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded text-[#7D8798] hover:bg-[#F3F5F9]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="rounded-md border border-[#F1D0CB] bg-[#FCF0EE] px-3 py-2.5 text-[12px] text-[#A72419]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1B449C] px-4 text-[13px] font-semibold text-white transition hover:bg-[#163981] focus:outline-none focus:ring-2 focus:ring-[#9CB1E0] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-7 border-t border-[#EDF0F5] pt-4 text-center">
          <p className="text-[11px] text-[#8C94A2]">African Oil · Store inventory</p>
        </div>
      </section>
    </main>
  )
}