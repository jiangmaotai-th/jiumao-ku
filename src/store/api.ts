export type Storefront = {
  code: string
  name: string
  flag: string
  currency: string
}

export type Category = { id: string; name: string }

export type PriceRow = {
  country: string
  regionName?: string
  flag?: string
  amount: number
  currency: string
  priceFormatted: string
  cny: number
  billCny?: number
  monthlyCny?: number
  billingPeriod?: string
  billingLabel?: string
  billingMonths?: number | null
  rank?: number | null
  isLowest?: boolean
  totalRegions?: number
}

export type Plan = {
  planId: string
  name: string
  billingPeriod?: string
  billingLabel?: string
  billingMonths?: number | null
}

export type PriceBase = {
  amount: number
  currency: string
  priceFormatted: string
  cny: number
  label?: string
}

export type PriceAnomaly = {
  country: string
  regionName?: string
  flag?: string
  amount: number
  currency: string
  priceFormatted: string
  cny: number
  vsBase: 'premium' | 'discount' | 'parity' | 'unknown'
  ratio?: number | null
  since?: string | null
  note?: string | null
}

export type ChannelAdvice = {
  summary: string
  appstoreBest?: {
    cny: number
    country: string
    regionName?: string
    flag?: string
    priceFormatted?: string
  } | null
  webBase?: PriceBase | null
  webPremiums?: PriceAnomaly[]
}

export type ProductPrices = {
  channel: string
  pricingModel?: 'unified' | 'regional'
  planId: string | null
  planName?: string
  billingPeriod?: string | null
  billingLabel?: string | null
  billingMonths?: number | null
  plans: Plan[]
  rows: PriceRow[]
  selected: PriceRow | null
  country: string | null
  updatedAt: string | null
  note: string | null
  maxCny?: number | null
  minCny?: number | null
  topN?: number
  order?: string
  base?: PriceBase | null
  anomalies?: PriceAnomaly[]
  warning?: string | null
  advice?: ChannelAdvice | null
}

export type PriceTrend = {
  direction: 'up' | 'down' | 'flat' | null
  pct?: number | null
  delta?: number | null
}

export type HomeCard = {
  productId: string
  name: string
  nameEn?: string
  category: string
  vendor: string
  icon: string
  hasFreeTier?: boolean
  isHot?: boolean
  best: PriceRow | null
  bestChannel?: string | null
  bestPlan?: string | null
  bestPlanName?: string | null
  tip?: string | null
  pending?: boolean
  trend?: PriceTrend | null
  updatedAt?: string | null
  channels?: { appstore?: boolean; web?: boolean; desktop?: boolean }
}

export type ProductCard = {
  productId: string
  name: string
  nameEn?: string
  vendor: string
  category: string
  icon: string
  hasFreeTier?: boolean
  isHot?: boolean
  changeNote?: string | null
  statusNote?: string | null
  planStructure?: string | null
  personalPlans?: string | null
  teamPlans?: string | null
  freeTrial?: string | null
  sheetUpdated?: string | null
  channels: { appstore: boolean; web: boolean; desktop: boolean }
  planCount: number
}

export type HistoryPoint = {
  t: string
  cny: number
  country?: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/store${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `http_${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchHome() {
  return get<{
    cards: HomeCard[]
    updatedAt?: string | null
    storefronts: Storefront[]
    categories: Category[]
  }>('/home')
}

export function fetchProducts(q = '', category = '') {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  const qs = params.toString()
  return get<{ items: ProductCard[]; categories: Category[] }>(
    `/products${qs ? `?${qs}` : ''}`,
  )
}

export function fetchProduct(productId: string, country = '') {
  const qs = country ? `?country=${encodeURIComponent(country)}` : ''
  return get<{
    product: ProductCard & {
      nameEn?: string
      availability?: Record<string, boolean>
      channels?: Record<string, unknown>
    }
    channelDocs: Record<
      string,
      {
        updatedAt: string | null
        planCount: number
        note: string | null
        defaultPlanId: string | null
        available: boolean
      }
    >
    storefronts: Storefront[]
    categories: Category[]
    refreshing: boolean
  }>(`/products/${productId}${qs}`)
}

export function fetchProductPrices(
  productId: string,
  channel: string,
  plan?: string,
  country = '',
) {
  const params = new URLSearchParams()
  params.set('channel', channel)
  if (plan) params.set('plan', plan)
  if (country) params.set('country', country)
  return get<ProductPrices>(`/products/${productId}/prices?${params}`)
}

export function fetchHistory(
  productId: string,
  channel: string,
  plan?: string,
  country = '',
) {
  const params = new URLSearchParams()
  params.set('channel', channel)
  if (plan) params.set('plan', plan)
  if (country) params.set('country', country)
  return get<{
    points: HistoryPoint[]
    planId: string
    mode: string
  }>(`/products/${productId}/history?${params}`)
}

export async function refreshProduct(productId: string, channel?: string) {
  const qs = channel ? `?channel=${encodeURIComponent(channel)}` : ''
  const res = await fetch(`/api/store/products/${productId}/refresh${qs}`, {
    method: 'POST',
  })
  const data = (await res.json()) as {
    ok?: boolean
    started?: boolean
    busy?: boolean
    error?: string
    message?: string
  }
  if (!res.ok && res.status !== 202) {
    throw new Error(data.error || `http_${res.status}`)
  }
  return data
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export const CHANNEL_LABELS: Record<string, string> = {
  appstore: 'App Store',
  web: '网页',
  desktop: '桌面',
}
