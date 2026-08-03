import { useEffect, useState, type FormEvent } from 'react'
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
  return (
    <header className="site-header">
      <div className="brand-block">
        <a className="brand-mark" href="/">
          九猫库
        </a>
        <p className="brand-sub">Switch 低价查询器</p>
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
          游戏
        </button>
        <a className="nav-link" href="/">
          返回九猫库
        </a>
      </nav>
    </header>
  )
}

function HomePage() {
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
        <h1 className="hero-title">Switch 低价查询器</h1>
        <p className="hero-lead">
          显示游戏低价区服。按折合人民币查看 Nintendo eShop 数字版各地区标价，数据来自公开店面，仅供参考。
        </p>
        <div className="hero-actions">
          <button type="button" className="btn btn-solid" onClick={() => navigate({ name: 'browse' })}>
            浏览游戏
          </button>
        </div>
      </section>

      <p className="section-label">热门数字版 · 10 款</p>
      {loading ? (
        <p className="loading">加载中…</p>
      ) : cards.length === 0 ? (
        <p className="empty">游戏列表准备中，可先去「游戏」搜索。</p>
      ) : (
        <div className="deal-list">
          {cards.map((card) => (
            <button
              key={card.gameId}
              type="button"
              className="deal-row"
              onClick={() => navigate({ name: 'game', gameId: card.gameId })}
            >
              <GameIcon src={card.icon} size={48} />
              <div className="deal-main">
                <p className="deal-name">{card.name}</p>
                <p className="deal-meta">
                  {card.best
                    ? `最低 ${formatCny(card.best.cny)} · ${card.best.flag || ''} ${card.best.regionName || card.best.country.toUpperCase()}`
                    : '点击查看低价区服'}
                  {card.savePct != null && card.savePct > 0
                    ? ` · 较美区约省 ${card.savePct}%`
                    : ''}
                </p>
              </div>
              <div className="deal-price">
                <strong>{card.best ? formatCny(card.best.cny) : '…'}</strong>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function BrowsePage() {
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
          搜索游戏
        </h1>
        <p className="hero-lead">支持中英文名；并行检索欧区 / 日区目录，并匹配美区等区服 NSUID。</p>
      </section>

      <form className="search-form" onSubmit={onSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 Switch 游戏（中英文）"
          aria-label="搜索游戏"
        />
        <button type="submit" className="btn btn-solid" disabled={loading}>
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>

      {error ? <p className="empty">{error}</p> : null}
      {loading && items.length === 0 ? <p className="loading">加载中…</p> : null}

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
              <p className="app-name">{game.name}</p>
              <p className="app-meta">{game.publisher || 'Nintendo'}</p>
            </div>
            <div className="app-side">
              <em>{game.regions > 0 ? `${game.regions} 个区服有价` : '低价区服'}</em>
            </div>
          </button>
        ))}
      </div>
    </>
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

function GameDetail({ gameId }: { gameId: string }) {
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
          if (hasRows) setStatusNote('价格已更新')
          else if (touched) setStatusNote('部分区服暂无数字版标价')
          else if (!retried) {
            retried = true
            await refreshGame(gameId).catch(() => null)
            setStatusNote('排队获取中…')
            continue
          } else setStatusNote('暂无价格数据')
          return
        }
        setStatusNote('正在获取各地区 eShop 标价…')
      }
      if (isAlive()) setStatusNote('获取超时，可再点「更新价格」重试')
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
          await waitForPrices(prev, '首次打开，正在获取价格…', () => alive)
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
      await waitForPrices(prevUpdatedAt, '已开始更新，正在获取各地区标价…')
    } catch (e) {
      setStatusNote(null)
      setError(String((e as Error).message || e))
      setRefreshing(false)
    }
  }

  if (loading) return <p className="loading">加载游戏…</p>
  if (error) return <p className="empty">{error}</p>
  if (!game) return <p className="empty">未找到游戏</p>

  return (
    <>
      <button type="button" className="back" onClick={() => navigate({ name: 'browse' })}>
        ← 返回游戏列表
      </button>

      <header className="detail-head">
        <GameIcon src={game.icon} size={72} />
        <div style={{ minWidth: 0 }}>
          <h1>{game.name}</h1>
          <p>{game.publisher || 'Nintendo'}</p>
          <div className="tags">
            <span>{game.category || '游戏'}</span>
            {(game.platforms || ['Nintendo Switch']).map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>
        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? '更新中…' : '更新价格'}
        </button>
      </header>
      {statusNote ? <p className="muted">{statusNote}</p> : null}

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

      {country && selected ? (
        <div className="region-card">
          <p className="region-card-label">
            所选区服 · {selected.flag} {selected.regionName}
          </p>
          <p className="region-card-value">{formatCny(selected.cny)}</p>
          <p className="region-card-meta">
            店面标价 {selected.priceFormatted}
            {selected.rank != null
              ? ` · 全球第 ${selected.rank} 名（共 ${selected.totalRegions ?? '—'} 区）`
              : ''}
            {selected.isLowest ? ' · 当前最低' : ''}
            {selected.onSale ? ' · 折扣中' : ''}
          </p>
        </div>
      ) : country ? (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          该区服暂无数字版标价，可点「更新价格」或换区服
        </p>
      ) : null}

      <div className="detail-grid">
        <section>
          <h2 className="panel-title">
            数字版 · 低价前{TOP_N}
            {updatedAt ? (
              <span className="muted" style={{ marginLeft: '0.65rem', fontSize: '0.85rem' }}>
                {new Date(updatedAt).toLocaleString('zh-CN')}
              </span>
            ) : null}
          </h2>
          <p className="muted" style={{ margin: '-0.35rem 0 0.85rem' }}>
            按人民币从低到高；第 1 名为最低价，仅列前 {TOP_N} 名。
            {country ? ' 所选区服若在榜内会高亮。' : ''}
          </p>
          {listLoading && rows.length === 0 ? (
            <p className="muted">正在读取各地区标价…</p>
          ) : rows.length === 0 ? (
            <p className="muted">暂无价格</p>
          ) : (
            <table className="price-table">
              <thead>
                <tr>
                  <th>名次</th>
                  <th>地区</th>
                  <th>店面标价</th>
                  <th>折合人民币</th>
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
                    <td>{r.priceFormatted}</td>
                    <td className={`cny${r.rank === 1 ? ' is-low' : ''}`}>
                      {formatCny(r.cny)}
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
        {route.name === 'game' ? <GameDetail gameId={route.gameId} /> : null}
        <p className="footer-note">
          展示 eShop 数字版公开标价折合人民币后最低的前 {TOP_N} 名（第 1 名最低），仅供参考，非
          Nintendo 官方服务。实体卡 / 账号区服解锁成本另计。
        </p>
      </div>
    </>
  )
}
