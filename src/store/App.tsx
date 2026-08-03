import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import {
  channelLabel,
  fetchHistory,
  fetchHome,
  fetchProduct,
  fetchProductPrices,
  fetchProducts,
  refreshProduct,
  sleep,
  type Category,
  type ChannelAdvice,
  type HistoryPoint,
  type HomeCard,
  type Plan,
  type PriceAnomaly,
  type PriceBase,
  type PriceRow,
  type ProductCard,
  type ProductPrices,
  type Storefront,
} from './api'
import {
  billingPeriodLabel,
  categoryLabel,
  formatChannelAdvice,
  localizeApiText,
} from './labels'
import { MoneyProvider, useMoney } from './money'

const TOP_N = 10

type Route =
  | { name: 'home' }
  | { name: 'browse' }
  | { name: 'product'; productId: string }

type Translator = (key: string, vars?: Record<string, string | number>) => string

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  if (!raw || raw === 'home') return { name: 'home' }
  if (raw === 'browse' || raw.startsWith('browse')) return { name: 'browse' }
  const m = /^product\/([^/]+)/.exec(raw)
  if (m) return { name: 'product', productId: decodeURIComponent(m[1]) }
  // legacy app/:id → browse
  if (/^app\//.test(raw)) return { name: 'browse' }
  return { name: 'home' }
}

function navigate(route: Route) {
  if (route.name === 'home') location.hash = '#/'
  else if (route.name === 'browse') location.hash = '#/browse'
  else location.hash = `#/product/${encodeURIComponent(route.productId)}`
}

function formatUpdatedAt(iso: string | null | undefined, locale: string, none: string) {
  if (!iso) return none
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return none
  return d.toLocaleString(locale, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatUpdateStamp(
  iso: string | null | undefined,
  locale: string,
  none: string,
  template: string,
) {
  const time = formatUpdatedAt(iso, locale, none)
  if (time === none) return none
  return template.replace('{time}', time)
}

/** Show plan tier next to price; drop redundant product name prefix when present. */
function formatPlanBesidePrice(planName?: string | null, productName?: string | null) {
  const plan = String(planName || '').trim()
  if (!plan) return ''
  const product = String(productName || '').trim()
  if (product) {
    const re = new RegExp(`^${product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i')
    const stripped = plan.replace(re, '').trim()
    if (stripped) return stripped
  }
  return plan
}

function PlatformIcon({ channel }: { channel: string }) {
  if (channel === 'appstore') {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12.3 8.4c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.3-2.5-1.4-1.1-.1-2.1.6-2.6.6-.6 0-1.4-.6-2.3-.6-1.2 0-2.3.7-2.9 1.8-1.3 2.2-.3 5.4.9 7.2.6.9 1.3 1.8 2.2 1.8.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6c1 0 1.6-.9 2.2-1.7.7-1 1-2 1-2.1-.1 0-1.9-.7-1.9-2.9zM10.7 3.3c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 .1-.5.4-.9 1.3-.8 2.1.8.1 1.6-.3 2.1 0z"
        />
      </svg>
    )
  }
  if (channel === 'desktop') {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          d="M2.5 3.2h11v7.2h-11zM5.5 13h5M8 10.4V13"
        />
      </svg>
    )
  }
  // web
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2.8v10.4M2.8 8h10.4M4.2 4.8c1.2.9 2.5 1.3 3.8 1.3s2.6-.4 3.8-1.3M4.2 11.2c1.2-.9 2.5-1.3 3.8-1.3s2.6.4 3.8 1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function PlatformBadge({ channel }: { channel?: string | null }) {
  const { t } = useT()
  const ch = channel || 'web'
  const label = channelLabel(ch, t)
  return (
    <span className={`platform-badge is-${ch}`}>
      <PlatformIcon channel={ch} />
      <span>{label}</span>
    </span>
  )
}

function FreeTierBadge() {
  const { t } = useT()
  return <span className="free-tier-badge">{t('store.freeTier')}</span>
}

function HotBadge() {
  const { t } = useT()
  return (
    <span className="hot-badge" title={t('store.hot')}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8.1 1.2c.3 1.8-.4 2.9-1.5 4.1C5.4 6.6 4.2 8 4.2 10a3.8 3.8 0 0 0 7.6 0c0-1.6-.7-2.7-1.7-3.9-.3-.4-.7-.8-1-1.3.9.9 1.9 2.1 1.9 3.8a4.9 4.9 0 1 1-9.7 0c0-2.4 1.4-4 2.8-5.5C5.5 2.4 6.6 1.4 8.1 1.2Z"
        />
      </svg>
      {t('store.hot')}
    </span>
  )
}

function ProductIcon({
  icon,
  name,
  size = 40,
}: {
  icon?: string
  name?: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const letter = (name || '?').slice(0, 1)
  const box = { width: size, height: size, fontSize: size >= 64 ? '1.5rem' : size >= 48 ? '1.2rem' : '1rem' }
  if (!icon || failed) {
    return (
      <span className="deal-fallback" style={box}>
        {letter}
      </span>
    )
  }
  return (
    <img
      className="product-icon"
      src={icon}
      alt=""
      width={size}
      height={size}
      style={box}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

/** Representative regions for web/desktop “same global price” table. */
const WEB_PARITY_CODES = [
  'us',
  'jp',
  'gb',
  'au',
  'sg',
  'hk',
  'tw',
  'kr',
  'de',
  'br',
  'in',
  'tr',
]

function buildWebParityRows(
  base: PriceBase,
  anomalies: PriceAnomaly[],
  storefronts: Storefront[],
  t: Translator,
) {
  const sfMap = Object.fromEntries(storefronts.map((s) => [s.code, s]))
  const anomalyMap = Object.fromEntries(anomalies.map((a) => [a.country, a]))
  const codes = [
    ...anomalies.map((a) => a.country),
    ...WEB_PARITY_CODES.filter((c) => !anomalyMap[c]),
  ]
  const seen = new Set<string>()
  return codes
    .filter((c) => {
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })
    .map((code) => {
      const a = anomalyMap[code]
      if (a) return a
      const sf = sfMap[code]
      return {
        country: code,
        regionName: sf?.name || code.toUpperCase(),
        flag: sf?.flag || '',
        amount: base.amount,
        currency: base.currency,
        priceFormatted: base.priceFormatted,
        cny: base.cny,
        vsBase: 'parity' as const,
        note: code === 'us' ? t('store.globalBenchmark') : t('store.usdParityNote'),
      }
    })
}

function Header({ route, updatedAt }: { route: Route; updatedAt?: string | null }) {
  const { t, locale } = useT()
  return (
    <header className="site-header">
      <div className="brand-block">
        <a className="brand-mark" href="/">
          {t('common.brand')}
        </a>
        <p className="brand-sub">
          {t('store.heroTitle')}
          <span className="brand-daily">
            {formatUpdateStamp(
              updatedAt,
              locale,
              t('store.none'),
              t('store.dailyBadge'),
            )}
          </span>
        </p>
      </div>
      <div className="site-header__right">
        <nav className="site-nav" aria-label="nav">
          <button
            type="button"
            className={`nav-link${route.name === 'home' ? ' is-active' : ''}`}
            onClick={() => navigate({ name: 'home' })}
          >
            {t('store.navHome')}
          </button>
          <button
            type="button"
            className={`nav-link${route.name === 'browse' ? ' is-active' : ''}`}
            onClick={() => navigate({ name: 'browse' })}
          >
            {t('store.navAll')}
          </button>
          <a className="nav-link" href="/">
            {t('common.backHome')}
          </a>
        </nav>
        <LangSwitchHost />
      </div>
    </header>
  )
}

function RankBars({ rows }: { rows: PriceRow[] }) {
  const { money, region } = useMoney()
  const max = rows[rows.length - 1]?.cny || 1
  return (
    <div className="dist">
      {rows.map((r) => (
        <div className="dist-row" key={r.country}>
          <span className="code">{r.country}</span>
          <div className="dist-bar" title={`${region(r.country, r.regionName)} ${money(r.cny)}`}>
            <span
              className={r.rank === 1 ? 'is-low' : undefined}
              style={{ width: `${Math.max(8, (r.cny / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function HistoryChart({
  points,
  label,
}: {
  points: HistoryPoint[]
  label: string
}) {
  const { t } = useT()
  const { money } = useMoney()
  const w = 520
  const h = 160
  const pad = 28
  const coords = useMemo(() => {
    if (points.length < 2) return null
    const ys = points.map((p) => p.cny)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const span = maxY - minY || 1
    const stepX = (w - pad * 2) / (points.length - 1)
    return points.map((p, i) => {
      const x = pad + i * stepX
      const y = pad + (1 - (p.cny - minY) / span) * (h - pad * 2)
      return { x, y, ...p }
    })
  }, [points])

  if (!points.length) {
    return <p className="muted">{t('store.noHistory')}</p>
  }
  if (!coords) {
    return (
      <p className="muted">
        {t('store.needTwoDays', {
          n: points.length,
          date: points[0]?.t || t('store.none'),
          price: money(points[0]?.cny),
        })}
      </p>
    )
  }

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  return (
    <div className="history-chart">
      <p className="muted" style={{ marginBottom: '0.5rem' }}>
        {t('store.samples', { label, n: points.length })}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={t('store.priceHistory')}>
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.2" />
        {coords.map((c) => (
          <circle key={c.t} cx={c.x} cy={c.y} r="3.2" fill="var(--gold-soft)">
            <title>
              {c.t} {money(c.cny)}
              {c.country ? ` · ${c.country.toUpperCase()}` : ''}
            </title>
          </circle>
        ))}
        <text x={pad} y={h - 6} fill="var(--ink-muted)" fontSize="11">
          {coords[0].t}
        </text>
        <text
          x={w - pad}
          y={h - 6}
          fill="var(--ink-muted)"
          fontSize="11"
          textAnchor="end"
        >
          {coords[coords.length - 1].t}
        </text>
      </svg>
    </div>
  )
}

function HomePage({
  onUpdatedAt,
}: {
  onUpdatedAt?: (iso: string | null) => void
}) {
  const { t } = useT()
  const { money, region, locale } = useMoney()
  const [cards, setCards] = useState<HomeCard[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const apply = (iso: string | null) => {
      setUpdatedAt(iso)
      onUpdatedAt?.(iso)
    }
    const load = () =>
      fetchHome()
        .then((data) => {
          if (!alive) return
          setCards(data.cards || [])
          apply(data.updatedAt || null)
        })
        .catch(() => {
          if (alive) setCards([])
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    load()
    const timer = window.setInterval(() => {
      fetchHome()
        .then((data) => {
          if (!alive) return
          const next = data.cards || []
          setCards(next)
          apply(data.updatedAt || null)
          if (next.filter((c) => !c.best).length === 0) window.clearInterval(timer)
        })
        .catch(() => {})
    }, 4000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [onUpdatedAt])

  return (
    <div className="home-page">
      <section className="hero home-hero">
        <div className="home-hero-row">
          <div className="home-hero-copy">
            <h1 className="hero-title">
              {t('store.heroTitle')}
              <span className="hero-daily">
                {formatUpdateStamp(
                  updatedAt,
                  locale,
                  t('store.none'),
                  t('store.dailyBadge'),
                )}
              </span>
            </h1>
            <p className="hero-lead">{t('store.heroLead')}</p>
          </div>
          <div className="home-updated">
            <span className="home-updated-label">{t('store.updatedAtLabel')}</span>
            <strong className="home-updated-value">
              {formatUpdatedAt(updatedAt, locale, t('store.none'))}
            </strong>
          </div>
        </div>
        <div className="home-more home-more--top">
          <button type="button" className="btn btn-solid" onClick={() => navigate({ name: 'browse' })}>
            {t('store.browseAll')}
          </button>
        </div>
      </section>

      {loading ? (
        <p className="loading">{t('store.loadingHome')}</p>
      ) : (
        <div className="home-deal-grid">
          {cards.map((card) => {
            const best = card.best
            const regionLabel =
              best && card.bestChannel === 'appstore'
                ? `${best.flag || ''} ${region(best.country, best.regionName || best.country.toUpperCase())}`.trim()
                : best
                  ? `${best.flag || ''} ${
                      best.country ? region(best.country, best.regionName) : t('store.globalWeb')
                    }`.trim()
                  : t('store.none')
            return (
              <button
                key={card.productId}
                type="button"
                className="home-deal-card"
                onClick={() => navigate({ name: 'product', productId: card.productId })}
              >
                <PlatformBadge channel={card.bestChannel || 'web'} />
                <div className="home-deal-head">
                  <ProductIcon icon={card.icon} name={card.name} size={44} />
                  <div className="home-deal-copy">
                    <p className="home-deal-name">{card.name}</p>
                  </div>
                </div>
                <div className="home-deal-lowest">
                  <span className="home-deal-lowest-label">{t('store.currentLowestRegion')}</span>
                  <strong className="home-deal-lowest-region">{regionLabel}</strong>
                </div>
                <p className="home-deal-price">
                  <span>{card.best ? money(card.best.cny) : t('store.none')}</span>
                  {card.bestPlanName ? (
                    <span className="home-deal-plan">
                      {formatPlanBesidePrice(card.bestPlanName, card.name)}
                    </span>
                  ) : null}
                </p>
                <span className="home-deal-cta">{t('store.viewProductDeals')}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BrowsePage() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ProductCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchProducts(q, category)
      .then((data) => {
        if (!alive) return
        setItems(data.items || [])
        setCategories(data.categories || [])
      })
      .catch(() => {
        if (alive) setItems([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [category])

  const { t } = useT()

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await fetchProducts(q.trim(), category)
      setItems(data.items || [])
      setCategories(data.categories || [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="hero" style={{ paddingBottom: '1.25rem' }}>
        <h1 className="hero-title" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)' }}>
          {t('store.browseTitle')}
        </h1>
        <p className="hero-lead">{t('store.browseLead')}</p>
      </section>

      <form className="search-row" onSubmit={onSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('store.searchPlaceholder')}
          aria-label={t('store.searchAria')}
        />
        <button type="submit" className="btn btn-solid" disabled={loading}>
          {loading ? t('common.searching') : t('common.search')}
        </button>
      </form>

      <div className="plan-bar" style={{ marginTop: '0.25rem' }}>
        <button
          type="button"
          className={`plan${!category ? ' is-active' : ''}`}
          onClick={() => setCategory('')}
        >
          {t('store.categoryAll')}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`plan${category === c.id ? ' is-active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {categoryLabel(c.id, t, c.name)}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <p className="loading">{t('store.loadingHome')}</p>
      ) : items.length === 0 ? (
        <p className="empty">{t('store.noMatch')}</p>
      ) : (
        <div className="app-grid">
          {items.map((p) => {
            const channelText =
              [
                p.channels.appstore ? channelLabel('appstore', t) : null,
                p.channels.web ? channelLabel('web', t) : null,
                p.channels.desktop ? channelLabel('desktop', t) : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('store.pending')
            return (
              <button
                key={p.productId}
                type="button"
                className="app-card"
                onClick={() => navigate({ name: 'product', productId: p.productId })}
              >
                <ProductIcon icon={p.icon} name={p.name} size={56} />
                <strong>{p.name}</strong>
                <span>{p.vendor}</span>
                <em>{channelText}</em>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function ProductDetail({ productId }: { productId: string }) {
  const { t } = useT()
  const { money, region, currency, locale } = useMoney()
  const [product, setProduct] = useState<(ProductCard & { nameEn?: string }) | null>(null)
  const [channelDocs, setChannelDocs] = useState<
    Record<
      string,
      {
        available: boolean
        note: string | null
        defaultPlanId: string | null
        planCount?: number
      }
    >
  >({})
  const [channel, setChannel] = useState('web')
  const [plans, setPlans] = useState<Plan[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [country, setCountry] = useState('')
  const [storefronts, setStorefronts] = useState<Storefront[]>([])
  const [rows, setRows] = useState<PriceRow[]>([])
  const [selected, setSelected] = useState<PriceRow | null>(null)
  const [pricingModel, setPricingModel] = useState<'unified' | 'regional'>('regional')
  const [base, setBase] = useState<PriceBase | null>(null)
  const [anomalies, setAnomalies] = useState<PriceAnomaly[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [advice, setAdvice] = useState<ChannelAdvice | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [historyMode, setHistoryMode] = useState<'lowest' | 'country'>('lowest')
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [billingLabel, setBillingLabel] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<string | null>(null)

  function applyPrices(prices: ProductPrices) {
    setPlans(prices.plans || [])
    setRows(prices.rows || [])
    setSelected(prices.selected || null)
    setUpdatedAt(prices.updatedAt)
    setNote(prices.note)
    setPricingModel(prices.pricingModel || (prices.base ? 'unified' : 'regional'))
    setBase(prices.base || null)
    setAnomalies(prices.anomalies || [])
    setWarning(prices.warning || null)
    setAdvice(prices.advice || null)
    setBillingLabel(prices.billingLabel || null)
    setBillingPeriod(prices.billingPeriod || null)
  }

  // Load product meta once — no polling (polling caused UI thrash).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setCountry('')
    setPlanId(null)
    setRows([])
    setBase(null)
    setAnomalies([])
    setAdvice(null)
    setHistory([])
    setStatusNote(null)
    ;(async () => {
      try {
        const data = await fetchProduct(productId)
        if (!alive) return
        // Canonicalize old ids (chatgpt-plus → chatgpt, etc.)
        const canonical = data.product?.productId
        if (canonical && canonical !== productId) {
          navigate({ name: 'product', productId: canonical })
          return
        }
        setProduct(data.product)
        setChannelDocs(data.channelDocs || {})
        setStorefronts(data.storefronts || [])
        const avail = data.channelDocs || {}
        // Prefer App Store first — that's where regional low prices live.
        const preferred =
          ['appstore', 'web', 'desktop'].find(
            (ch) => avail[ch]?.available || (avail[ch]?.planCount || 0) > 0,
          ) || 'web'
        setChannel(preferred)
        setPlanId(avail[preferred]?.defaultPlanId || null)
        setLoading(false)
        refreshProduct(canonical || productId).catch(() => null)
      } catch (e) {
        if (alive) {
          setError(String((e as Error).message || e))
          setLoading(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [productId])

  // Single loader for prices + history — avoids channel/planId effect ping-pong.
  useEffect(() => {
    if (loading || !channel) return
    let alive = true
    setListLoading(true)
    ;(async () => {
      try {
        const prices = await fetchProductPrices(
          productId,
          channel,
          planId || undefined,
          country,
        )
        if (!alive) return
        applyPrices(prices)
        // Fix stale planId from another channel (e.g. appstore → web).
        const planOk =
          !planId ||
          (prices.plans || []).some((p) => p.planId === planId) ||
          prices.planId === planId
        if (!planOk || (!planId && prices.planId)) {
          const next =
            prices.planId ||
            prices.plans?.[0]?.planId ||
            null
          if (next && next !== planId) {
            setPlanId(next)
            return
          }
        }
        const hist = await fetchHistory(
          productId,
          channel,
          prices.planId || planId || undefined,
          historyMode === 'country' ? country : '',
        )
        if (!alive) return
        setHistory(hist.points || [])
      } catch {
        if (alive) {
          setRows([])
          setSelected(null)
          setBase(null)
          setAnomalies([])
          setAdvice(null)
          setHistory([])
        }
      } finally {
        if (alive) setListLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [productId, channel, planId, country, historyMode, loading])

  async function onRefresh() {
    if (refreshing) return
    setRefreshing(true)
    setStatusNote(t('store.updatingChannel'))
    try {
      await refreshProduct(productId, channel)
      await sleep(2500)
      const meta = await fetchProduct(productId)
      setChannelDocs(meta.channelDocs || {})
      setProduct(meta.product)
      const prices = await fetchProductPrices(
        productId,
        channel,
        planId || undefined,
        country,
      )
      applyPrices(prices)
      const resolvedPlan =
        prices.planId &&
        (prices.plans || []).some((p) => p.planId === prices.planId)
          ? prices.planId
          : prices.plans?.[0]?.planId || null
      if (resolvedPlan && resolvedPlan !== planId) setPlanId(resolvedPlan)
      // If plan was wrong on first pull, fetch once more with corrected id.
      let finalPrices = prices
      if (
        (prices.pricingModel === 'unified' || channel === 'web' || channel === 'desktop') &&
        !prices.base &&
        resolvedPlan &&
        resolvedPlan !== planId
      ) {
        finalPrices = await fetchProductPrices(
          productId,
          channel,
          resolvedPlan,
          country,
        )
        applyPrices(finalPrices)
      }
      const hist = await fetchHistory(
        productId,
        channel,
        finalPrices.planId || resolvedPlan || planId || undefined,
        historyMode === 'country' ? country : '',
      )
      setHistory(hist.points || [])
      const ok =
        finalPrices.pricingModel === 'unified' ||
        channel === 'web' ||
        channel === 'desktop'
          ? Boolean(finalPrices.base)
          : Boolean(finalPrices.rows?.length)
      setStatusNote(ok ? t('store.priceUpdated') : t('store.noPriceChannel'))
    } catch (e) {
      setError(String((e as Error).message || e))
      setStatusNote(null)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <p className="loading">{t('store.loadingProduct')}</p>
  if (error) return <p className="empty">{error}</p>
  if (!product) return <p className="empty">{t('common.noData')}</p>

  const planName = plans.find((p) => p.planId === planId)?.name || t('store.plan')
  const isUnified = pricingModel === 'unified' || channel === 'web' || channel === 'desktop'
  const displayBase = base || advice?.webBase || null
  const historyRegionLabel =
    historyMode === 'country' && country
      ? region(country, selected?.regionName)
      : t('store.globalLowest')
  const adviceText = formatChannelAdvice(advice, t, money, region)
  const periodLabel = billingPeriodLabel(billingPeriod, t, billingLabel)
  const safeNote = localizeApiText(note, locale)
  const safeWarning = localizeApiText(warning, locale)

  return (
    <>
      <button type="button" className="back" onClick={() => navigate({ name: 'browse' })}>
        {t('store.backToAll')}
      </button>

      <header className="detail-head">
        <ProductIcon icon={product.icon} name={product.name} size={72} />
        <div style={{ minWidth: 0 }}>
          <h1>
            {product.name}
            {product.isHot ? <HotBadge /> : null}
            {product.hasFreeTier ? <FreeTierBadge /> : null}
          </h1>
          <p>{product.vendor}</p>
          <div className="tags">
            <span>{categoryLabel(product.category, t, product.category)}</span>
            <span>{t('store.heroTitle')}</span>
          </div>
        </div>
        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? t('store.updating') : t('store.updatePrices')}
        </button>
      </header>
      {localizeApiText(product.planStructure, locale) ? (
        <p className="sheet-structure">
          <span className="sheet-structure-label">{t('store.planStructure')}</span>
          {localizeApiText(product.planStructure, locale)}
        </p>
      ) : null}
      {localizeApiText(product.statusNote, locale) ? (
        <p className="muted sheet-status">
          {t('store.status')}: {localizeApiText(product.statusNote, locale)}
        </p>
      ) : null}
      {statusNote ? <p className="muted">{statusNote}</p> : null}

      <p className="section-label">{t('store.buyChannel')}</p>
      <div className="plan-bar">
        {(['appstore', 'web', 'desktop'] as const).map((ch) => {
          const avail =
            channelDocs[ch]?.available || (channelDocs[ch]?.planCount || 0) > 0
          return (
            <button
              key={ch}
              type="button"
              className={`plan${channel === ch ? ' is-active' : ''}`}
              disabled={!avail && ch !== 'web'}
              onClick={() => {
                if (ch === channel) return
                setRows([])
                setSelected(null)
                setBase(null)
                setAnomalies([])
                setAdvice(null)
                setWarning(null)
                setHistory([])
                setStatusNote(null)
                setCountry('')
                setPlanId(channelDocs[ch]?.defaultPlanId || null)
                setPricingModel(
                  ch === 'web' || ch === 'desktop' ? 'unified' : 'regional',
                )
                setChannel(ch)
              }}
            >
              {channelLabel(ch, t)}
              {!avail && ch !== 'web' ? ` · ${t('store.none')}` : ''}
            </button>
          )
        })}
      </div>

      {adviceText ? (
        <div className="advice-card">
          <p className="advice-label">{t('store.channelAdvice')}</p>
          <p className="advice-text">{adviceText}</p>
        </div>
      ) : null}

      {!isUnified ? (
        <>
          <p className="section-label">{t('store.pickRegion')}</p>
          <div className="region-bar">
            <select
              className="region-select"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label={t('store.pickRegion')}
            >
              <option value="">{t('store.allRegionsTop')}</option>
              {storefronts.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.flag} {region(s.code, s.name)} ({s.code.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {country && selected && !isUnified ? (
        <div className="region-card">
          <p className="region-card-label">
            {t('store.selectedRegion')} · {selected.flag} {region(selected.country, selected.regionName)} ·{' '}
            {channelLabel(channel, t)}
          </p>
          <p className="region-card-value">{money(selected.cny)}</p>
          <p className="region-card-meta">
            {t('store.listPrice')} {selected.priceFormatted}
            {selected.rank != null ? ` · ${t('store.rank', { n: String(selected.rank) })}` : ''}
            {selected.isLowest ? ` · ${t('store.lowest')}` : ''}
          </p>
        </div>
      ) : null}

      <p className="section-label">{t('store.plan')}</p>
      <div className="plan-bar">
        {plans.length === 0 ? (
          <span className="muted">{safeNote || t('store.noPlanPrice')}</span>
        ) : (
          plans.map((p) => (
            <button
              key={p.planId}
              type="button"
              className={`plan${planId === p.planId ? ' is-active' : ''}`}
              onClick={() => setPlanId(p.planId)}
            >
              {p.name}
              {p.billingPeriod && p.billingPeriod !== 'month' ? (
                <span className="plan-period">
                  {billingPeriodLabel(p.billingPeriod, t, p.billingLabel)}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>

      {isUnified ? (
        <div className="unified-panel">
          <h2 className="panel-title">
            {channelLabel(channel, t)} · {planName} · {t('store.globalUnified')}
            {updatedAt ? (
              <span className="muted" style={{ marginLeft: '0.65rem', fontSize: '0.85rem' }}>
                {formatUpdatedAt(updatedAt, locale, t('store.none'))}
              </span>
            ) : null}
          </h2>
          <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
            {t('store.usdParityNote')}
          </p>
          {listLoading && !displayBase ? (
            <p className="muted">{t('common.loading')}</p>
          ) : !displayBase ? (
            <p className="muted">{safeNote || t('store.noWebDesktop')}</p>
          ) : (
            <>
              <div className="region-card">
                <p className="region-card-label">
                  {localizeApiText(displayBase.label, locale) || t('store.unifiedStripe')}
                </p>
                <p className="region-card-value">{money(displayBase.cny)}</p>
                <p className="region-card-meta">
                  {t('store.listPrice')} {displayBase.priceFormatted}
                  {displayBase.currency ? ` · ${displayBase.currency}` : ''}
                </p>
              </div>
              {safeWarning ? <p className="channel-warning">{safeWarning}</p> : null}
              <p className="section-label">{t('store.region')}</p>
              <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
                {t('store.usdParityNote')}
              </p>
              <div className="detail-grid">
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>{t('store.region')}</th>
                      <th>{t('store.listPrice')}</th>
                      <th>{t('store.equiv', { currency })}</th>
                      <th>{t('store.relativeUs')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildWebParityRows(displayBase, anomalies, storefronts, t).map((a) => (
                      <tr key={a.country}>
                        <td>
                          {a.flag} {region(a.country, a.regionName)}
                          {'since' in a && a.since ? (
                            <span className="muted"> · {a.since}</span>
                          ) : null}
                        </td>
                        <td>{a.priceFormatted}</td>
                        <td
                          className={`cny${a.vsBase === 'premium' ? '' : a.vsBase === 'discount' ? ' is-low' : ''}`}
                        >
                          {money(a.cny)}
                        </td>
                        <td>
                          <span
                            className={
                              a.vsBase === 'premium'
                                ? 'tag-premium'
                                : a.vsBase === 'discount'
                                  ? 'tag-low'
                                  : 'tag-parity'
                            }
                          >
                            {a.vsBase === 'premium'
                              ? t('store.premium')
                              : a.vsBase === 'discount'
                                ? t('store.cheap')
                                : a.country === 'us'
                                  ? t('store.baseline')
                                  : t('store.equivalent')}
                          </span>
                          {localizeApiText(a.note, locale) ? (
                            <span className="muted" style={{ marginLeft: '0.4rem' }}>
                              {localizeApiText(a.note, locale)}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <aside>
                  <h2 className="panel-title">{t('store.relativeUs')}</h2>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
                    {t('store.usdParityNote')}
                  </p>
                </aside>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="detail-grid">
          <section>
            <h2 className="panel-title">
              {channelLabel(channel, t)} · {planName}
              {periodLabel ? ` · ${periodLabel}` : ''} · {t('store.topNLowest', { n: TOP_N })}
              {updatedAt ? (
                <span className="muted" style={{ marginLeft: '0.65rem', fontSize: '0.85rem' }}>
                  {formatUpdatedAt(updatedAt, locale, t('store.none'))}
                </span>
              ) : null}
            </h2>
            <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
              {billingPeriod && billingPeriod !== 'month'
                ? t('store.billingMonthHint', { period: periodLabel || t('store.bill') })
                : t('store.appstoreRankHint', { currency })}
            </p>
            {listLoading && rows.length === 0 ? (
              <p className="muted">{t('common.loading')}</p>
            ) : rows.length === 0 ? (
              <p className="muted">{safeNote || t('store.noPrice')}</p>
            ) : (
              <table className="price-table">
                <thead>
                  <tr>
                    <th>{t('store.rank', { n: '' })}</th>
                    <th>{t('store.region')}</th>
                    <th>{t('store.listPrice')}</th>
                    <th>
                      {billingPeriod && billingPeriod !== 'month'
                        ? t('store.equivMonth', { currency })
                        : t('store.equiv', { currency })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.country}
                      className={country && r.country === country ? 'is-selected' : undefined}
                    >
                      <td>{r.rank != null ? t('store.rank', { n: String(r.rank) }) : t('store.none')}</td>
                      <td>
                        {r.flag} {region(r.country, r.regionName)}
                      </td>
                      <td>
                        {r.priceFormatted}
                        {r.billingPeriod && r.billingPeriod !== 'month' ? (
                          <span className="muted">
                            {' '}
                            · {billingPeriodLabel(r.billingPeriod, t, r.billingLabel)}
                          </span>
                        ) : null}
                      </td>
                      <td className={`cny${r.rank === 1 ? ' is-low' : ''}`}>
                        {money(r.cny)}
                        {r.billCny != null &&
                        r.billingPeriod &&
                        r.billingPeriod !== 'month' ? (
                          <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>
                            {t('store.bill')} {money(r.billCny)}
                          </span>
                        ) : null}
                        {r.rank === 1 ? (
                          <>
                            {' '}
                            <span className="tag-low">{t('store.lowestTag')}</span>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <aside>
            <h2 className="panel-title">{t('store.topNLowest', { n: TOP_N })}</h2>
            <RankBars rows={rows} />
          </aside>
        </div>
      )}

      <p className="section-label" style={{ marginTop: '1.75rem' }}>
        {t('store.priceHistory')}
      </p>
      <div className="plan-bar">
        <button
          type="button"
          className={`plan${historyMode === 'lowest' ? ' is-active' : ''}`}
          onClick={() => setHistoryMode('lowest')}
        >
          {isUnified ? t('store.globalUnified') : t('store.globalLowest')}
        </button>
        {!isUnified ? (
          <button
            type="button"
            className={`plan${historyMode === 'country' ? ' is-active' : ''}`}
            onClick={() => setHistoryMode('country')}
            disabled={!country}
          >
            {t('store.selectedRegion')}
          </button>
        ) : null}
      </div>
      <HistoryChart
        points={history}
        label={`${channelLabel(channel, t)} · ${isUnified ? t('store.globalUnified') : historyRegionLabel}`}
      />
    </>
  )
}

export function App() {
  const { t } = useT()
  const [route, setRoute] = useState<Route>(() => parseHash())
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!location.hash) location.hash = '#/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let alive = true
    fetchHome()
      .then((data) => {
        if (alive) setUpdatedAt(data.updatedAt || null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return (
    <MoneyProvider>
      <div className="atmosphere" aria-hidden="true" />
      <div className="shell">
        <Header route={route} updatedAt={updatedAt} />
        {route.name === 'home' ? <HomePage onUpdatedAt={setUpdatedAt} /> : null}
        {route.name === 'browse' ? <BrowsePage /> : null}
        {route.name === 'product' ? <ProductDetail productId={route.productId} /> : null}
        <p className="footer-note">{t('store.disclaimer')}</p>
      </div>
    </MoneyProvider>
  )
}
