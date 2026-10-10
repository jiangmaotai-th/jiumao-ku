import './admin.css'

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

type Note = {
  id: string
  text: string
  path: string
  locale: string
  at: number
}

type Tab = 'stats' | 'notes'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app missing')

function fmt(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch,
  )
}

function fmtTime(at: number): string {
  return new Date(at).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function bindChrome(tab: Tab) {
  root!.querySelector('#refresh-btn')?.addEventListener('click', () => {
    if (tab === 'notes') void showNotes()
    else void showDashboard()
  })
  root!.querySelector('#logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    renderLogin()
  })
  root!.querySelector('#tab-stats')?.addEventListener('click', () => {
    void showDashboard()
  })
  root!.querySelector('#tab-notes')?.addEventListener('click', () => {
    void showNotes()
  })
}

function shell(tab: Tab, title: string, subtitle: string, body: string): string {
  return `
    <main class="admin-shell wide">
      <header class="admin-head">
        <div>
          <h1>${title}</h1>
          <p class="muted">${subtitle}</p>
        </div>
        <div class="actions">
          <button type="button" id="refresh-btn" class="ghost">刷新</button>
          <button type="button" id="logout-btn" class="ghost">退出</button>
        </div>
      </header>
      <nav class="admin-tabs" aria-label="后台分区">
        <button type="button" id="tab-stats" class="${tab === 'stats' ? 'is-on' : ''}">数据看板</button>
        <button type="button" id="tab-notes" class="${tab === 'notes' ? 'is-on' : ''}">小纸条</button>
      </nav>
      ${body}
    </main>`
}

function renderLogin(error = '') {
  root!.innerHTML = `
    <main class="admin-shell">
      <section class="login-card">
        <h1>九猫库后台</h1>
        <p class="muted">查看访问数据与私密小纸条</p>
        <form id="login-form">
          <label>
            <span>密码</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          ${error ? `<p class="error">${error}</p>` : ''}
          <button type="submit">登录</button>
        </form>
      </section>
    </main>`

  root!.querySelector('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target as HTMLFormElement)
    const password = String(fd.get('password') || '')
    const btn = root!.querySelector('button[type="submit"]') as HTMLButtonElement | null
    if (btn) btn.disabled = true
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        const msg =
          data.error === 'too_many_attempts'
            ? '尝试过多，请稍后再试'
            : data.error === 'admin_not_configured'
              ? '服务器未配置后台密码'
              : '密码错误'
        renderLogin(msg)
        return
      }
      await showDashboard()
    } catch {
      renderLogin('网络错误')
    }
  })
}

function renderDashboard(stats: Stats) {
  const rows = stats.apps
    .map(
      (a) => `
    <tr>
      <td class="name">${escapeHtml(a.name)}<span class="id">${escapeHtml(a.id)}</span></td>
      <td>${fmt(a.viewUvToday)}<small>/${fmt(a.viewUvTotal)}</small></td>
      <td>${fmt(a.viewPvToday)}<small>/${fmt(a.viewPvTotal)}</small></td>
      <td>${fmt(a.downloadToday)}<small>/${fmt(a.downloadTotal)}</small></td>
      <td>${fmt(a.useToday)}<small>/${fmt(a.useTotal)}</small></td>
    </tr>`,
    )
    .join('')

  root!.innerHTML = shell(
    'stats',
    '数据看板',
    `日期 ${escapeHtml(stats.todayKey)}（上海时区）· 访客计数仅后台可见`,
    `
      <section class="stat-cards" aria-label="全站访客">
        <article>
          <p>累计访客</p>
          <strong>${fmt(stats.site.total)}</strong>
        </article>
        <article>
          <p>今日访客</p>
          <strong>${fmt(stats.site.today)}</strong>
        </article>
      </section>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>应用</th>
              <th>访问 UV<small>今日/累计</small></th>
              <th>访问 PV<small>今日/累计</small></th>
              <th>下载<small>今日/累计</small></th>
              <th>使用<small>今日/累计</small></th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5" class="muted">暂无数据</td></tr>`}</tbody>
        </table>
      </div>
      <p class="hint muted">访问 = 打开应用页；下载 = 安装包或「在线使用」点击；使用 = 实际完成转换/搜索等操作。</p>`,
  )
  bindChrome('stats')
}

function renderNotes(list: Note[]) {
  const cards = list
    .map(
      (n) => `
    <article class="note-card">
      <header>
        <time>${fmtTime(n.at)}</time>
        <span>${escapeHtml(n.path || '—')}${n.locale ? ` · ${escapeHtml(n.locale)}` : ''}</span>
      </header>
      <p>${escapeHtml(n.text)}</p>
    </article>`,
    )
    .join('')

  root!.innerHTML = shell(
    'notes',
    '小纸条',
    `共 ${fmt(list.length)} 张 · 仅后台可见，不会出现在网站上`,
    `
      <div class="note-list">
        ${cards || `<p class="muted">还没有小纸条。</p>`}
      </div>`,
  )
  bindChrome('notes')
}

async function showDashboard() {
  root!.innerHTML = `<main class="admin-shell"><p class="muted">加载中…</p></main>`
  const res = await fetch('/api/admin/stats', { credentials: 'same-origin' })
  if (res.status === 401) {
    renderLogin()
    return
  }
  if (!res.ok) {
    renderLogin('无法加载数据')
    return
  }
  const stats = (await res.json()) as Stats
  renderDashboard(stats)
}

async function showNotes() {
  root!.innerHTML = `<main class="admin-shell"><p class="muted">加载中…</p></main>`
  const res = await fetch('/api/admin/notes', { credentials: 'same-origin' })
  if (res.status === 401) {
    renderLogin()
    return
  }
  if (!res.ok) {
    renderLogin('无法加载小纸条')
    return
  }
  const data = (await res.json()) as { list?: Note[] }
  renderNotes(Array.isArray(data.list) ? data.list : [])
}

void (async () => {
  const res = await fetch('/api/admin/stats', { credentials: 'same-origin' })
  if (res.ok) {
    renderDashboard((await res.json()) as Stats)
  } else {
    renderLogin()
  }
})()
