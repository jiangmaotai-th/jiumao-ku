export type Storefront = {
  code: string
  name: string
  flag: string
  currency: string
  region?: string
}

export type GameCard = {
  gameId: string
  name: string
  nameEn?: string
  publisher: string
  icon: string
  summary?: string
  category: string
  platforms: string[]
  regions: number
}

export type HomeCard = {
  gameId: string
  name: string
  nameEn?: string
  icon: string
  best: PriceRow | null
  us?: PriceRow | null
  savePct: number | null
  pending?: boolean
  regions?: number
}

export type PriceRow = {
  country: string
  regionName?: string
  flag?: string
  amount: number
  currency: string
  priceFormatted: string
  cny: number
  rank?: number | null
  isLowest?: boolean
  totalRegions?: number
  onSale?: boolean
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/switch${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `http_${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchHome() {
  return get<{ cards: HomeCard[]; storefronts: Storefront[] }>('/home')
}

export function fetchGames(q = '') {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  const qs = params.toString()
  return get<{ items: GameCard[] }>(`/games${qs ? `?${qs}` : ''}`)
}

export function fetchGame(gameId: string, country = '') {
  const qs = country ? `?country=${encodeURIComponent(country)}` : ''
  return get<{
    game: GameCard & { nameEn?: string; nsuids?: Record<string, string> }
    country: string | null
    storefronts: Storefront[]
    updatedAt: string | null
    refreshing: boolean
    regionCount: number
  }>(`/games/${gameId}${qs}`)
}

export function fetchPrices(gameId: string, country = '') {
  const params = new URLSearchParams()
  if (country) params.set('country', country)
  const qs = params.toString()
  return get<{
    rows: PriceRow[]
    selected: PriceRow | null
    country: string | null
    updatedAt: string | null
    maxCny: number | null
    minCny: number | null
  }>(`/games/${gameId}/prices${qs ? `?${qs}` : ''}`)
}

export async function refreshGame(gameId: string) {
  const res = await fetch(`/api/switch/games/${gameId}/refresh`, { method: 'POST' })
  const data = (await res.json()) as {
    ok?: boolean
    started?: boolean
    busy?: boolean
    previousUpdatedAt?: string | null
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
