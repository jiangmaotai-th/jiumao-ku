import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import {
  getLocale,
  initLocale,
  onLocaleChange,
  t as translate,
  tList as translateList,
  type Locale,
} from './index'
import { mountLanguageSwitcher } from './switcher'

const I18nContext = createContext({
  locale: 'en' as Locale,
  t: translate,
  tList: translateList,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => initLocale())

  useEffect(() => onLocaleChange(setLocaleState), [])

  const value = useMemo(
    () => ({
      locale,
      t: translate,
      tList: translateList,
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT() {
  return useContext(I18nContext)
}

/** Mount shared language switcher into a DOM host (usually #lang-switch). */
export function useLanguageSwitcher(hostId = 'lang-switch') {
  const { locale } = useT()
  useEffect(() => {
    mountLanguageSwitcher(document.getElementById(hostId))
  }, [locale, hostId])
}

export function ensureLocaleBoot(): Locale {
  return getLocale() || initLocale()
}
