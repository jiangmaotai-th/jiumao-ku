import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CHANNEL_LABELS,
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

const TOP_N = 10

type Route =
  | { name: 'home' }
  | { name: 'browse' }
  | { name: 'product'; productId: string }

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

function formatCny(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—'
  return `¥${n.toFixed(2)}`
}

function formatUpdatedAt(iso?: string | null) {
  if (!iso) return '暂无'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '暂无'
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  const ch = channel || 'web'
  const label = CHANNEL_LABELS[ch] || ch
  return (
    <span className={`platform-badge is-${ch}`}>
      <PlatformIcon channel={ch} />
      <span>{label}</span>
    </span>
  )
}

function FreeTierBadge() {
  return <span className="free-tier-badge">可免费</span>
}

function HotBadge() {
  return (
    <span className="hot-badge" title="热门">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8.1 1.2c.3 1.8-.4 2.9-1.5 4.1C5.4 6.6 4.2 8 4.2 10a3.8 3.8 0 0 0 7.6 0c0-1.6-.7-2.7-1.7-3.9-.3-.4-.7-.8-1-1.3.9.9 1.9 2.1 1.9 3.8a4.9 4.9 0 1 1-9.7 0c0-2.4 1.4-4 2.8-5.5C5.5 2.4 6.6 1.4 8.1 1.2Z"
        />
      </svg>
      HOT
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
        note: code === 'us' ? '全球基准' : '与全球美元价同值（非商店区域低价）',
      }
    })
}

function Header({ route }: { route: Route }) {
  return (
    <header className="site-header">
      <div className="brand-block">
        <a className="brand-mark" href="/">
          九猫库
        </a>
        <p className="brand-sub">
          AI 订阅低价区查询器<span className="brand-daily">（每日更新）</span>
        </p>
      </div>
      <nav className="site-nav" aria-label="页面导航">
        <button
          type="button"
          className={`nav-link${route.name === 'home' ? ' is-active' : ''}`}
          onClick={() => navigate({ name: 'home' })}
        >
          首页
        </button>
        <button
          type="button"
          className={`nav-link${route.name === 'browse' ? ' is-active' : ''}`}
          onClick={() => navigate({ name: 'browse' })}
        >
          全部 AI
        </button>
        <a className="nav-link" href="/">
          返回九猫库
        </a>
      </nav>
    </header>
  )
}

function RankBars({ rows }: { rows: PriceRow[] }) {
  const max = rows[rows.length - 1]?.cny || 1
  return (
    <div className="dist">
      {rows.map((r) => (
        <div className="dist-row" key={r.country}>
          <span className="code">{r.country}</span>
          <div className="dist-bar" title={`${r.regionName} ${formatCny(r.cny)}`}>
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
    return <p className="muted">暂无历史数据（刷新价格后开始记录）</p>
  }
  if (!coords) {
    return (
      <p className="muted">
        已有 {points.length} 个采样点（{points[0]?.t} · {formatCny(points[0]?.cny)}
        ），需至少 2 天才能画曲线
      </p>
    )
  }

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  return (
    <div className="history-chart">
      <p className="muted" style={{ marginBottom: '0.5rem' }}>
        {label} · 近 {points.length} 个采样日
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="价格历史">
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.2" />
        {coords.map((c) => (
          <circle key={c.t} cx={c.x} cy={c.y} r="3.2" fill="var(--gold-soft)">
            <title>
              {c.t} {formatCny(c.cny)}
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

function HomePage() {
  const [cards, setCards] = useState<HomeCard[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchHome()
        .then((data) => {
          if (!alive) return
          setCards(data.cards || [])
          setUpdatedAt(data.updatedAt || null)
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
          setUpdatedAt(data.updatedAt || null)
          if (next.filter((c) => !c.best).length === 0) window.clearInterval(timer)
        })
        .catch(() => {})
    }, 4000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="home-page">
      <section className="hero home-hero">
        <div className="home-hero-row">
          <div className="home-hero-copy">
            <h1 className="hero-title">
              AI 订阅低价区查询器<span className="hero-daily">（每日更新）</span>
            </h1>
            <p className="hero-lead">
              覆盖全球主流 AI 订阅。App Store / 网页 / 桌面分通道查看最低价区服，并跟踪价格历史。
            </p>
          </div>
          <div className="home-updated">
            <span className="home-updated-label">更新时间</span>
            <strong className="home-updated-value">{formatUpdatedAt(updatedAt)}</strong>
          </div>
        </div>
        <div className="home-more home-more--top">
          <button type="button" className="btn btn-solid" onClick={() => navigate({ name: 'browse' })}>
            浏览全部 AI
          </button>
        </div>
      </section>

      {loading ? (
        <p className="loading">加载中…</p>
      ) : (
        <div className="home-deal-grid">
          {cards.map((card) => {
            const regionLabel =
              card.bestChannel === 'appstore'
                ? `${card.best?.flag || ''} ${card.best?.regionName || card.best?.country?.toUpperCase() || ''}`.trim()
                : card.best
                  ? `${card.best.flag || '🌐'} ${card.best.regionName || '全球网页价'}`
                  : '暂无数据'
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
                  <span className="home-deal-lowest-label">当前最低区</span>
                  <strong className="home-deal-lowest-region">{regionLabel}</strong>
                </div>
                <p className="home-deal-price">
                  <span>{card.best ? formatCny(card.best.cny) : '…'}</span>
                  {card.bestPlanName ? (
                    <span className="home-deal-plan">
                      {formatPlanBesidePrice(card.bestPlanName, card.name)}
                    </span>
                  ) : null}
                </p>
                <span className="home-deal-cta">查看产品全部低价</span>
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
          全部 AI 订阅
        </h1>
        <p className="hero-lead">按品类筛选；支持中英文名搜索。</p>
      </section>

      <form className="search-row" onSubmit={onSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 ChatGPT、Claude、Cursor…"
          aria-label="搜索 AI 产品"
        />
        <button type="submit" className="btn btn-solid" disabled={loading}>
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>

      <div className="plan-bar" style={{ marginTop: '0.25rem' }}>
        <button
          type="button"
          className={`plan${!category ? ' is-active' : ''}`}
          onClick={() => setCategory('')}
        >
          全部
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`plan${category === c.id ? ' is-active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <p className="loading">加载中…</p>
      ) : items.length === 0 ? (
        <p className="empty">没有匹配的产品</p>
      ) : (
        <div className="app-grid">
          {items.map((p) => {
            const channelText =
              [
                p.channels.appstore ? 'App Store' : null,
                p.channels.web ? '网页' : null,
                p.channels.desktop ? '桌面' : null,
              ]
                .filter(Boolean)
                .join(' · ') || '待接入'
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
    setStatusNote('正在更新当前通道标价…')
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
      setStatusNote(ok ? '价格已更新' : '该通道暂无标价，可稍后再试')
    } catch (e) {
      setError(String((e as Error).message || e))
      setStatusNote(null)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <p className="loading">加载产品…</p>
  if (error) return <p className="empty">{error}</p>
  if (!product) return <p className="empty">未找到产品</p>

  const planName = plans.find((p) => p.planId === planId)?.name || '套餐'
  const isUnified = pricingModel === 'unified' || channel === 'web' || channel === 'desktop'
  const displayBase = base || advice?.webBase || null

  return (
    <>
      <button type="button" className="back" onClick={() => navigate({ name: 'browse' })}>
        ← 返回全部 AI
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
            <span>{product.category}</span>
            <span>AI 订阅</span>
          </div>
        </div>
        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? '更新中…' : '更新价格'}
        </button>
      </header>
      {product.planStructure ? (
        <p className="sheet-structure">
          <span className="sheet-structure-label">套餐结构</span>
          {product.planStructure}
        </p>
      ) : null}
      {product.changeNote ? (
        <div className="change-note">
          <p className="change-note-label">变动说明</p>
          <p className="change-note-text">{product.changeNote}</p>
          {product.sheetUpdated ? (
            <p className="change-note-meta">表格更新于 {product.sheetUpdated}</p>
          ) : null}
        </div>
      ) : null}
      {product.statusNote ? (
        <p className="muted sheet-status">状态：{product.statusNote}</p>
      ) : null}
      {statusNote ? <p className="muted">{statusNote}</p> : null}

      <p className="section-label">购买通道</p>
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
              {CHANNEL_LABELS[ch]}
              {!avail && ch !== 'web' ? ' · 暂无' : ''}
            </button>
          )
        })}
      </div>

      {advice?.summary ? (
        <div className="advice-card">
          <p className="advice-label">该走哪个通道</p>
          <p className="advice-text">{advice.summary}</p>
        </div>
      ) : null}

      {!isUnified ? (
        <>
          <p className="section-label">选择国家 / 区服</p>
          <div className="region-bar">
            <select
              className="region-select"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="选择国家区服"
            >
              <option value="">全部地区（看低价前{TOP_N}）</option>
              {storefronts.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.flag} {s.name}（{s.code.toUpperCase()}）
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {country && selected && !isUnified ? (
        <div className="region-card">
          <p className="region-card-label">
            所选区服 · {selected.flag} {selected.regionName} · {CHANNEL_LABELS[channel]}
          </p>
          <p className="region-card-value">{formatCny(selected.cny)}</p>
          <p className="region-card-meta">
            标价 {selected.priceFormatted}
            {selected.rank != null ? ` · 第 ${selected.rank} 名` : ''}
            {selected.isLowest ? ' · 当前最低' : ''}
          </p>
        </div>
      ) : null}

      <p className="section-label">套餐</p>
      <div className="plan-bar">
        {plans.length === 0 ? (
          <span className="muted">{note || '该通道暂无套餐标价'}</span>
        ) : (
          plans.map((p) => (
            <button
              key={p.planId}
              type="button"
              className={`plan${planId === p.planId ? ' is-active' : ''}`}
              onClick={() => setPlanId(p.planId)}
            >
              {p.name}
              {p.billingLabel && p.billingPeriod && p.billingPeriod !== 'month' ? (
                <span className="plan-period">{p.billingLabel}</span>
              ) : null}
            </button>
          ))
        )}
      </div>

      {isUnified ? (
        <div className="unified-panel">
          <h2 className="panel-title">
            {CHANNEL_LABELS[channel]} · {planName} · 全球统一价
            {updatedAt ? (
              <span className="muted" style={{ marginLeft: '0.65rem', fontSize: '0.85rem' }}>
                {new Date(updatedAt).toLocaleString('zh-CN')}
              </span>
            ) : null}
          </h2>
          <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
            网页/桌面走 Stripe/官网收款，通常全球同价；不会出现 App Store 那种印度/土耳其骨折区。
          </p>
          {listLoading && !displayBase ? (
            <p className="muted">正在读取标价…</p>
          ) : !displayBase ? (
            <p className="muted">{note || '暂无网页/桌面标价，点「更新价格」重试'}</p>
          ) : (
            <>
              <div className="region-card">
                <p className="region-card-label">
                  {displayBase.label || '全球统一标价（Stripe / 官网）'}
                </p>
                <p className="region-card-value">{formatCny(displayBase.cny)}</p>
                <p className="region-card-meta">
                  标价 {displayBase.priceFormatted}
                  {displayBase.currency ? ` · ${displayBase.currency}` : ''}
                </p>
              </div>
              {warning ? <p className="channel-warning">{warning}</p> : null}
              <p className="section-label">各地区对照（非低价排行）</p>
              <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
                网页几乎全球同价，下表不是「低价前10」。想看骨折区请切到 App Store。
              </p>
              <div className="detail-grid">
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>地区</th>
                      <th>标价</th>
                      <th>折合人民币</th>
                      <th>相对美区</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildWebParityRows(displayBase, anomalies, storefronts).map((a) => (
                      <tr key={a.country}>
                        <td>
                          {a.flag} {a.regionName || a.country.toUpperCase()}
                          {'since' in a && a.since ? (
                            <span className="muted"> · 自 {a.since}</span>
                          ) : null}
                        </td>
                        <td>{a.priceFormatted}</td>
                        <td
                          className={`cny${a.vsBase === 'premium' ? '' : a.vsBase === 'discount' ? ' is-low' : ''}`}
                        >
                          {formatCny(a.cny)}
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
                              ? '溢价'
                              : a.vsBase === 'discount'
                                ? '低价'
                                : a.country === 'us'
                                  ? '基准'
                                  : '等价'}
                          </span>
                          {a.note ? (
                            <span className="muted" style={{ marginLeft: '0.4rem' }}>
                              {a.note}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <aside>
                  <h2 className="panel-title">说明</h2>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
                    「等价」= 与 $ 全球价同值，不是 App Store 印度/土耳其那种区域折扣。真正低价排行在
                    App Store 通道。
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
              {CHANNEL_LABELS[channel]} · {planName}
              {billingLabel ? ` · ${billingLabel}` : ''} · 低价前{TOP_N}
              {updatedAt ? (
                <span className="muted" style={{ marginLeft: '0.65rem', fontSize: '0.85rem' }}>
                  {new Date(updatedAt).toLocaleString('zh-CN')}
                </span>
              ) : null}
            </h2>
            <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
              {billingPeriod && billingPeriod !== 'month'
                ? `按${billingLabel || '账期'}账单折合月价排序（店面标价可能与月付档相同，但计费周期不同）。`
                : 'App Store 内购区域定价，按人民币从低到高；第 1 名为最低价。'}
            </p>
            {listLoading && rows.length === 0 ? (
              <p className="muted">正在读取标价…</p>
            ) : rows.length === 0 ? (
              <p className="muted">{note || '暂无价格'}</p>
            ) : (
              <table className="price-table">
                <thead>
                  <tr>
                    <th>名次</th>
                    <th>地区</th>
                    <th>店面标价</th>
                    <th>{billingPeriod && billingPeriod !== 'month' ? '折合月价' : '折合人民币'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.country}
                      className={country && r.country === country ? 'is-selected' : undefined}
                    >
                      <td>{r.rank}</td>
                      <td>
                        {r.flag} {r.regionName || r.country.toUpperCase()}
                      </td>
                      <td>
                        {r.priceFormatted}
                        {r.billingLabel && r.billingPeriod && r.billingPeriod !== 'month' ? (
                          <span className="muted"> · {r.billingLabel}</span>
                        ) : null}
                      </td>
                      <td className={`cny${r.rank === 1 ? ' is-low' : ''}`}>
                        {formatCny(r.cny)}
                        {r.billCny != null &&
                        r.billingPeriod &&
                        r.billingPeriod !== 'month' ? (
                          <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>
                            账单 {formatCny(r.billCny)}
                          </span>
                        ) : null}
                        {r.rank === 1 ? (
                          <>
                            {' '}
                            <span className="tag-low">最低</span>
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
            <h2 className="panel-title">最低前{TOP_N}</h2>
            <RankBars rows={rows} />
          </aside>
        </div>
      )}

      <p className="section-label" style={{ marginTop: '1.75rem' }}>
        价格历史
      </p>
      <div className="plan-bar">
        <button
          type="button"
          className={`plan${historyMode === 'lowest' ? ' is-active' : ''}`}
          onClick={() => setHistoryMode('lowest')}
        >
          {isUnified ? '全球统一价' : '全球最低'}
        </button>
        {!isUnified ? (
          <button
            type="button"
            className={`plan${historyMode === 'country' ? ' is-active' : ''}`}
            onClick={() => setHistoryMode('country')}
            disabled={!country}
          >
            所选区服
          </button>
        ) : null}
      </div>
      <HistoryChart
        points={history}
        label={`${CHANNEL_LABELS[channel]} · ${
          isUnified
            ? '全球统一价'
            : historyMode === 'country' && country
              ? country.toUpperCase()
              : '全球最低'
        }`}
      />
    </>
  )
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash())

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!location.hash) location.hash = '#/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      <div className="atmosphere" aria-hidden="true" />
      <div className="shell">
        <Header route={route} />
        {route.name === 'home' ? <HomePage /> : null}
        {route.name === 'browse' ? <BrowsePage /> : null}
        {route.name === 'product' ? <ProductDetail productId={route.productId} /> : null}
        <p className="footer-note">
          App Store 展示各区服内购低价前 {TOP_N}；网页/桌面展示全球统一价与本地溢价异常点。低价区通常只对商店内购成立。非官方服务，实际扣款以账户区服为准。
        </p>
      </div>
    </>
  )
}
