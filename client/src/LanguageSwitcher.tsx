import { useLanguage, type Language } from './LanguageContext'

const options: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'አማርኛ' },
]

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div role="group" aria-label="Language" className={`inline-flex items-center rounded-md border border-[#DDE2EC] bg-white p-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
      {options.map((option) => <button
        key={option.value}
        type="button"
        lang={option.value}
        aria-pressed={language === option.value}
        onClick={() => setLanguage(option.value)}
        className={`rounded px-2 py-1.5 font-semibold transition ${language === option.value ? 'bg-[#1B449C] text-white' : 'text-[#667187] hover:bg-[#F3F5F9]'}`}
      >{option.label}</button>)}
    </div>
  )
}
