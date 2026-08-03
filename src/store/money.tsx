import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useT } from '../i18n/react'
import type { Locale } from '../i18n/types'
import { fetchFx } from './api'
import {
  formatMoney,
  LOCALE_CURRENCY,
  regionDisplayName,
  type FxRates,
} from './currency'

type MoneyApi = {
  locale: Locale
  currency: string
  rates: Record<string, number>
  ready: boolean
  money: (cny?: number | null) => string
  region: (code?: string | null, fallback?: string | null) => string
}

const MoneyContext = createContext<MoneyApi | null>(null)

export function MoneyProvider({ children }: { children: ReactNode }) {
  const { locale } = useT()
  const [fx, setFx] = useState<FxRates | null>(null)

  useEffect(() => {
    let alive = true
    fetchFx()
      .then((data) => {
        if (alive) setFx(data)
      })
      .catch(() => {
        if (alive) setFx({ base: 'CNY', rates: { CNY: 1 } })
      })
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<MoneyApi>(() => {
    const rates = fx?.rates || { CNY: 1 }
    return {
      locale,
      currency: LOCALE_CURRENCY[locale],
      rates,
      ready: !!fx,
      money: (cny) => formatMoney(cny, locale, rates),
      region: (code, fallback) => regionDisplayName(code, locale, fallback),
    }
  }, [locale, fx])

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
}

export function useMoney(): MoneyApi {
  const ctx = useContext(MoneyContext)
  if (!ctx) throw new Error('useMoney requires MoneyProvider')
  return ctx
}
