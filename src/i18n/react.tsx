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
  localizedHref,
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
  lh: (path: string) => localizedHref(path),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => initLocale())

  useEffect(() => onLocaleChange(setLocaleState), [])

  const value = useMemo(
    () => ({
      locale,
      // Bind to locale so consumers re-render when language changes (even if translate fn identity is stable).
      t: ((path: string, vars?: Record<string, string | number>) =>
        translate(path, vars)) as typeof translate,
      tList: ((path: string) => translateList(path)) as typeof translateList,
      lh: (path: string) => localizedHref(path, locale),
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
