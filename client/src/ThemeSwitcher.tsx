import { Moon, Sun } from 'lucide-react'
import { useLanguage } from './LanguageContext'
import { useTheme } from './ThemeContext'

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const label = t(theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={theme === 'dark'}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#DDE2EC] bg-white text-[#667187] hover:bg-[#F2F5FA] hover:text-[#1B449C] focus:outline-none focus:ring-2 focus:ring-[#9CB1E0]"
    >
      <Icon size={15} />
      <span className="sr-only">{label}</span>
    </button>
  )
}
