import { StrictMode, useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type AppRow = {
  id: string
  name: string
  viewPvTotal: number
  viewPvToday: number
  viewUvTotal: number
  viewUvToday: number
  downloadTotal: number
  downloadToday: number
  useTotal: number
  useToday: number
}

type Stats = {
  site: { total: number; today: number }
  todayKey: string
  updatedAt: string
  apps: AppRow[]
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `http_${res.status}`)
  }
  return data
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

function Login({ onOk }: { onOk: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      onOk()
    } catch (err) {
      const msg = String((err as Error).message || err)
      setError(
        msg === 'invalid_password'
          ? '密码错误'
          : msg === 'too_many_attempts'
            ? '尝试过多，请稍后再试'
            : msg === 'admin_not_configured'
              ? '后台密码未配置'
              : '登录失败',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>后台登录</h1>
        <p>九猫库访客与应用统计看板</p>
        {error ? <p className="error">{error}</p> : null}
        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-solid" type="submit" disabled={busy || !password}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api<Stats>('/api/admin/stats')
      setStats(data)
    } catch (err) {
      const msg = String((err as Error).message || err)
      if (msg === 'unauthorized') {
        onLogout()
        return
      }
      setError('加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  async function logout() {
    try {
      await api('/api/admin/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    onLogout()
  }

  return (
    <div className="shell">
      <header className="top">
        <div>
          <div className="brand">九猫库 · 后台</div>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            统计日（上海）{stats?.todayKey || '—'} · 更新于 {formatTime(stats?.updatedAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.55rem' }}>
          <a className="btn" href="/">
            回首页
          </a>
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            刷新
          </button>
          <button type="button" className="btn" onClick={() => void logout()}>
            退出
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="stats-grid">
        <div className="stat">
          <div className="label">全站累计访客</div>
          <div className="value">{stats?.site.total ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">今日访客</div>
          <div className="value">{stats?.site.today ?? '—'}</div>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <strong>各应用数据</strong>
          <span className="muted">{loading ? '刷新中…' : `${stats?.apps.length || 0} 个应用`}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>应用</th>
                <th>浏览 UV 今日</th>
                <th>浏览 UV 累计</th>
                <th>浏览 PV 今日</th>
                <th>浏览 PV 累计</th>
                <th>下载今日</th>
                <th>下载累计</th>
                <th>使用今日</th>
                <th>使用累计</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.apps || []).map((app) => (
                <tr key={app.id}>
                  <td>
                    <div>{app.name}</div>
                    <div className="muted">{app.id}</div>
                  </td>
                  <td className="num">{app.viewUvToday}</td>
                  <td className="num">{app.viewUvTotal}</td>
                  <td className="num">{app.viewPvToday}</td>
                  <td className="num">{app.viewPvTotal}</td>
                  <td className="num">{app.downloadToday}</td>
                  <td className="num">{app.downloadTotal}</td>
                  <td className="num">{app.useToday}</td>
                  <td className="num">{app.useTotal}</td>
                </tr>
              ))}
              {!loading && (!stats?.apps || stats.apps.length === 0) ? (
                <tr>
                  <td colSpan={9} className="muted">
                    暂无应用数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    api<Stats>('/api/admin/stats')
      .then(() => {
        if (alive) setAuthed(true)
      })
      .catch(() => {
        if (alive) setAuthed(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (authed == null) {
    return (
      <div className="login-wrap">
        <p className="muted">加载中…</p>
      </div>
    )
  }

  return authed ? (
    <Dashboard onLogout={() => setAuthed(false)} />
  ) : (
    <Login onOk={() => setAuthed(true)} />
  )
}

const root = document.getElementById('app')
if (!root) throw new Error('app root missing')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
