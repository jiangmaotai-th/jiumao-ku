import { useEffect, useState, type FormEvent } from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import type { Locale } from '../i18n/types'
import { regionDisplayName } from '../store/currency'
import {
  fetchGame,
  fetchGames,
  fetchHome,
  fetchPrices,
  refreshGame,
  sleep,
  type GameCard,
  type HomeCard,
  type PriceRow,
  type Storefront,
} from './api'

const TOP_N = 10

type Route =
  | { name: 'home' }
  | { name: 'browse' }
  | { name: 'game'; gameId: string }

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  if (!raw || raw === 'home') return { name: 'home' }
  if (raw === 'browse' || raw.startsWith('browse')) return { name: 'browse' }
  const m = /^game\/([^/]+)/.exec(raw)
  if (m) return { name: 'game', gameId: decodeURIComponent(m[1]) }
  return { name: 'home' }
}

function navigate(route: Route) {
  if (route.name === 'home') location.hash = '#/'
  else if (route.name === 'browse') location.hash = '#/browse'
  else location.hash = `#/game/${encodeURIComponent(route.gameId)}`
}

function formatCny(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—'
  return `¥${n.toFixed(2)}`
}

function isChineseLocale(locale: Locale) {
  return locale === 'zh-CN' || locale === 'zh-TW'
}

function gameDisplayName(game: { name: string; nameEn?: string }, locale: Locale) {
  if (!isChineseLocale(locale) && game.nameEn?.trim()) return game.nameEn
  return game.name
}

function localizedRegionName(
  code: string | null | undefined,
  locale: Locale,
  fallback?: string | null,
) {
  return regionDisplayName(code, locale, fallback)
}

function categoryDisplayName(category: string | null | undefined, locale: Locale, fallback: string) {
  if (!category) return fallback
  return isChineseLocale(locale) ? category : fallback
}

const ICON_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="#1a211c" width="128" height="128"/><text x="64" y="70" text-anchor="middle" fill="#8a7340" font-size="14" font-family="sans-serif">Switch</text></svg>`,
  )

function GameIcon({
  src,
  size,
}: {
  src?: string
  size: number
}) {
  return (
    <img
      src={src || ICON_FALLBACK}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget
        if (el.src !== ICON_FALLBACK) el.src = ICON_FALLBACK
      }}
    />
  )
}

function Header({ route }: { route: Route }) {
  const { t } = useT()
  return (
    <header className="site-header">
      <div className="brand-block">
        <a className="brand-mark" href="/">
          {t('common.brand')}
        </a>
        <p className="brand-sub">{t('catalog.switch-price.name')}</p>
      </div>
      <div className="site-header__right">
        <nav className="site-nav" aria-label="nav">
          <button
            type="button"
            className={`nav-link${route.name === 'home' ? ' is-active' : ''}`}
            onClick={() => navigate({ name: 'home' })}
          >
            {t('switchApp.navHome')}
          </button>
          <button
            type="button"
            className={`nav-link${route.name === 'browse' ? ' is-active' : ''}`}
            onClick={() => navigate({ name: 'browse' })}
          >
            {t('switchApp.navSearch')}
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

function HomePage() {
  const { t, locale } = useT()
  const [cards, setCards] = useState<HomeCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchHome()
        .then((data) => {
          if (alive) setCards((data.cards || []).slice(0, 10))
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
          const next = (data.cards || []).slice(0, 10)
          setCards(next)
          const pending = next.filter((c) => !c.best).length
          if (pending === 0) window.clearInterval(timer)
        })
        .catch(() => {})
    }, 4000)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <>
      <section className="hero">
        <p className="hero-kicker">maotaiworks.com</p>
        <h1 className="hero-title">{t('switchApp.heroTitle')}</h1>
        <p className="hero-lead">{t('switchApp.heroLead')}</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-solid" onClick={() => navigate({ name: 'browse' })}>
            {t('switchApp.browseGames')}
          </button>
        </div>
      </section>

      <p className="section-label">{t('switchApp.popularDigitalTitle', { n: TOP_N })}</p>
      {loading ? (
        <p className="loading">{t('switchApp.loadingHome')}</p>
      ) : cards.length === 0 ? (
        <p className="empty">{t('switchApp.homeEmpty')}</p>
      ) : (
        <div className="deal-list">
          {cards.map((card) => {
            const bestRegion = card.best
              ? localizedRegionName(card.best.country, locale, card.best.regionName)
              : ''
            return (
              <button
                key={card.gameId}
                type="button"
                className="deal-row"
                onClick={() => navigate({ name: 'game', gameId: card.gameId })}
              >
                <GameIcon src={card.icon} size={48} />
                <div className="deal-main">
                  <p className="deal-name">{gameDisplayName(card, locale)}</p>
                  <p className="deal-meta">
                    {card.best
                      ? t('switchApp.lowestWithRegion', {
                          price: formatCny(card.best.cny),
                          flag: card.best.flag || '',
                          region: bestRegion || card.best.country.toUpperCase(),
                        })
                      : t('switchApp.viewLowPriceRegions')}
                    {card.savePct != null && card.savePct > 0
                      ? ` · ${t('switchApp.saveVsUs', { pct: card.savePct })}`
                      : ''}
                  </p>
                </div>
                <div className="deal-price">
                  <strong>{card.best ? formatCny(card.best.cny) : '…'}</strong>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function BrowsePage() {
  const { t, locale } = useT()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<GameCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchGames('')
      .then((data) => {
        if (alive) setItems(data.items || [])
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await fetchGames(q.trim())
      setItems(data.items || [])
    } catch (err) {
      setError(String((err as Error).message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="hero" style={{ paddingBottom: '1.5rem' }}>
        <h1 className="hero-title" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)' }}>
          {t('switchApp.browseTitle')}
        </h1>
        <p className="hero-lead">{t('switchApp.browseLead')}</p>
      </section>

      <form className="search-form" onSubmit={onSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('switchApp.searchPlaceholder')}
          aria-label={t('switchApp.navSearch')}
        />
        <button type="submit" className="btn btn-solid" disabled={loading}>
          {loading ? t('common.searching') : t('common.search')}
        </button>
      </form>

      {error ? <p className="empty">{error}</p> : null}
      {loading && items.length === 0 ? <p className="loading">{t('common.loading')}</p> : null}

      <div className="app-list">
        {items.map((game) => (
          <button
            key={game.gameId}
            type="button"
            className="app-row"
            onClick={() => navigate({ name: 'game', gameId: game.gameId })}
          >
            <GameIcon src={game.icon} size={48} />
            <div className="app-main">
              <p className="app-name">{gameDisplayName(game, locale)}</p>
              <p className="app-meta">{game.publisher || 'Nintendo'}</p>
            </div>
            <div className="app-side">
              <em>
                {game.regions > 0
                  ? t('switchApp.pricedRegions', { count: game.regions })
                  : t('switchApp.lowPriceRegions')}
              </em>
            </div>
          </button>
        ))}
      </div>
      {!loading && items.length === 0 && !error ? (
        <p className="empty">
          {q.trim() ? t('switchApp.noSearchResults') : t('switchApp.browseEmpty')}
        </p>
      ) : null}
    </>
  )
}

function RankBars({ rows, locale }: { rows: PriceRow[]; locale: Locale }) {
  const max = rows[rows.length - 1]?.cny || 1
  return (
    <div className="dist">
      {rows.map((r) => (
        <div className="dist-row" key={r.country}>
          <span className="code">{r.country}</span>
          <div
            className="dist-bar"
            title={`${localizedRegionName(r.country, locale, r.regionName)} ${formatCny(r.cny)}`}
          >
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

function GameDetail({ gameId }: { gameId: string }) {
  const { t, locale } = useT()
  const [game, setGame] = useState<(GameCard & { nameEn?: string }) | null>(null)
  const [country, setCountry] = useState('')
  const [storefronts, setStorefronts] = useState<Storefront[]>([])
  const [rows, setRows] = useState<PriceRow[]>([])
  const [selected, setSelected] = useState<PriceRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function applyPriceRows(raw: PriceRow[]) {
    return [...raw]
      .filter((r) => typeof r.cny === 'number')
      .sort((a, b) => a.cny - b.cny)
      .slice(0, TOP_N)
      .map((r, i) => ({ ...r, rank: i + 1, isLowest: i === 0 }))
  }

  async function pullOnce(region = country) {
    const data = await fetchGame(gameId, region)
    setGame(data.game)
    if (data.storefronts?.length) setStorefronts(data.storefronts)
    setUpdatedAt(data.updatedAt)
    const prices = await fetchPrices(gameId, region)
    setRows(applyPriceRows(prices.rows || []))
    setSelected(prices.selected || null)
    setUpdatedAt(prices.updatedAt || data.updatedAt)
    return { data, prices }
  }

  async function waitForPrices(
    prevUpdatedAt: string | null,
    label: string,
    isAlive: () => boolean = () => true,
  ) {
    setRefreshing(true)
    setStatusNote(label)
    const deadline = Date.now() + 90_000
    let retried = false
    try {
      while (Date.now() < deadline) {
        if (!isAlive()) return
        await sleep(2000)
        if (!isAlive()) return
        const { data, prices } = await pullOnce()
        if (!isAlive()) return
        const hasRows = (prices.rows || []).length > 0
        const finished = !data.refreshing
        const touched =
          Boolean(prices.updatedAt) && prices.updatedAt !== prevUpdatedAt

        if (finished) {
          if (hasRows) setStatusNote(t('switchApp.priceUpdated'))
          else if (touched) setStatusNote(t('switchApp.partialNoDigitalPrices'))
          else if (!retried) {
            retried = true
            await refreshGame(gameId).catch(() => null)
            setStatusNote(t('switchApp.queuedFetching'))
            continue
          } else setStatusNote(t('switchApp.noPriceData'))
          return
        }
        setStatusNote(t('switchApp.fetchingEShopPrices'))
      }
      if (isAlive()) setStatusNote(t('switchApp.fetchTimeout'))
    } finally {
      if (isAlive()) setRefreshing(false)
    }
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setStatusNote(null)
    setRefreshing(false)
    setRows([])
    setSelected(null)
    setCountry('')

    ;(async () => {
      try {
        const data = await fetchGame(gameId)
        if (!alive) return
        setGame(data.game)
        setUpdatedAt(data.updatedAt)
        if (data.storefronts?.length) setStorefronts(data.storefronts)
        setLoading(false)

        if ((data.regionCount || 0) === 0) {
          const prev = data.updatedAt
          if (!data.refreshing) await refreshGame(gameId).catch(() => null)
          if (!alive) return
          await waitForPrices(prev, t('switchApp.initialFetch'), () => alive)
        } else {
          const prices = await fetchPrices(gameId)
          if (!alive) return
          setRows(applyPriceRows(prices.rows || []))
          setSelected(prices.selected || null)
        }
      } catch (e) {
        if (alive) {
          setError(String((e as Error).message || e))
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  useEffect(() => {
    if (loading) return
    let alive = true
    setListLoading(true)
    fetchPrices(gameId, country)
      .then((data) => {
        if (!alive) return
        setRows(applyPriceRows(data.rows || []))
        setSelected(data.selected || null)
        setUpdatedAt(data.updatedAt)
      })
      .catch(() => {
        if (alive) {
          setRows([])
          setSelected(null)
        }
      })
      .finally(() => {
        if (alive) setListLoading(false)
      })
    return () => {
      alive = false
    }
  }, [gameId, country, loading])

  async function onRefresh() {
    if (refreshing) return
    setError(null)
    const prevUpdatedAt = updatedAt
    try {
      await refreshGame(gameId)
      await waitForPrices(prevUpdatedAt, t('switchApp.refreshStarted'))
    } catch (e) {
      setStatusNote(null)
      setError(String((e as Error).message || e))
      setRefreshing(false)
    }
  }

  if (loading) return <p className="loading">{t('switchApp.loadingGame')}</p>
  if (error) return <p className="empty">{error}</p>
  if (!game) return <p className="empty">{t('switchApp.gameNotFound')}</p>

  return (
    <>
      <button type="button" className="back" onClick={() => navigate({ name: 'browse' })}>
        {t('switchApp.backToBrowse')}
      </button>

      <header className="detail-head">
        <GameIcon src={game.icon} size={72} />
        <div style={{ minWidth: 0 }}>
          <h1>{gameDisplayName(game, locale)}</h1>
          <p>{game.publisher || 'Nintendo'}</p>
          <div className="tags">
            <span>
              {categoryDisplayName(game.category, locale, t('switchApp.gameCategoryFallback'))}
            </span>
            {(game.platforms || ['Nintendo Switch']).map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>
        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? t('common.refreshing') : t('switchApp.updatePrices')}
        </button>
      </header>
      {statusNote ? <p className="muted">{statusNote}</p> : null}

      <p className="section-label">{t('switchApp.pickRegion')}</p>
      <div className="region-bar">
        <select
          className="region-select"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label={t('switchApp.pickRegionAria')}
        >
          <option value="">{t('switchApp.allRegionsTop', { n: TOP_N })}</option>
          {storefronts.map((s) => (
            <option key={s.code} value={s.code}>
              {s.flag} {localizedRegionName(s.code, locale, s.name)} ({s.code.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {country && selected ? (
        <div className="region-card">
          <p className="region-card-label">
            {t('switchApp.selectedRegion')} · {selected.flag}{' '}
            {localizedRegionName(selected.country, locale, selected.regionName)}
          </p>
          <p className="region-card-value">{formatCny(selected.cny)}</p>
          <p className="region-card-meta">
            {t('switchApp.storefrontPrice', { price: selected.priceFormatted })}
            {selected.rank != null
              ? ` · ${t('switchApp.globalRank', {
                  rank: selected.rank,
                  total: selected.totalRegions ?? '—',
                })}`
              : ''}
            {selected.isLowest ? ` · ${t('switchApp.currentLowest')}` : ''}
            {selected.onSale ? ` · ${t('switchApp.onSale')}` : ''}
          </p>
        </div>
      ) : country ? (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          {t('switchApp.noSelectedRegionPrice')}
        </p>
      ) : null}

      <div className="detail-grid">
        <section>
          <h2 className="panel-title">
            {t('switchApp.digitalTopN', { n: TOP_N })}
            {updatedAt ? (
              <span className="muted" style={{ marginLeft: '0.65rem', fontSize: '0.85rem' }}>
                {new Date(updatedAt).toLocaleString(locale)}
              </span>
            ) : null}
          </h2>
          <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
            {t('switchApp.rankHint', { n: TOP_N })}
            {country ? ` ${t('switchApp.selectedHighlightHint')}` : ''}
          </p>
          {listLoading && rows.length === 0 ? (
            <p className="muted">{t('switchApp.loadingPrices')}</p>
          ) : rows.length === 0 ? (
            <p className="muted">{t('switchApp.noPrices')}</p>
          ) : (
            <table className="price-table">
              <thead>
                <tr>
                  <th>{t('switchApp.rank')}</th>
                  <th>{t('switchApp.region')}</th>
                  <th>{t('switchApp.listPrice')}</th>
                  <th>{t('switchApp.equivCny')}</th>
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
                      {r.flag} {localizedRegionName(r.country, locale, r.regionName) || r.country.toUpperCase()}
                    </td>
                    <td>{r.priceFormatted}</td>
                    <td className={`cny${r.rank === 1 ? ' is-low' : ''}`}>
                      {formatCny(r.cny)}
                      {r.rank === 1 ? (
                        <>
                          {' '}
                          <span className="tag-low">{t('switchApp.lowestTag')}</span>
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
          <h2 className="panel-title">{t('switchApp.topNLowest', { n: TOP_N })}</h2>
          <RankBars rows={rows} locale={locale} />
        </aside>
      </div>
    </>
  )
}

export function App() {
  const { t } = useT()
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
        {route.name === 'game' ? <GameDetail gameId={route.gameId} /> : null}
        <p className="footer-note">
          {t('switchApp.disclaimer', { n: TOP_N })}
        </p>
      </div>
    </>
  )
}
