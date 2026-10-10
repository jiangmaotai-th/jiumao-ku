import '../styles/main.css'
import '../ai-daily/board.css'
import './arena.css'
import { trackView } from '../analytics'
import { initLocale, localizedHref, t } from '../i18n'
import { mountLanguageSwitcher } from '../i18n/switcher'
import { formatBeijingTime } from '../ai-daily/render'
import { predictLeft } from './battle'
import { arenaExtra } from '../i18n/arena-extra'
import { getLocale } from '../i18n'
import { arenaCopy, escapeHtml, fill, renderArenaRailItem } from './data'
import { mountArena } from './widget'
import type { BattleResult, Side } from './types'

initLocale()
const copy = arenaCopy()
const ex = arenaExtra(getLocale())
document.title = copy.metaTitle
document.querySelector('meta[name="description"]')?.setAttribute('content', copy.metaDescription)

const rootEl = document.getElementById('arena-root')
if (!rootEl) throw new Error('arena-root missing')
const root: HTMLElement = rootEl
const home = localizedHref('/')
const year = String(new Date().getFullYear())

root.innerHTML = `
  <aside class="app-rail" id="app-rail" aria-label="${escapeHtml(copy.title)}">
    <nav class="app-rail__nav">
      ${renderArenaRailItem(true)}
      <a class="app-rail__item" href="${localizedHref('/ai/')}"><span>AI</span></a>
      <span class="app-rail__divider" aria-hidden="true"></span>
      <a class="app-rail__item app-rail__item--home" href="${home}"><span>${escapeHtml(copy.backHome.replace('← ', ''))}</span></a>
    </nav>
  </aside>
  <header class="site-header">
    <div class="brand-block">
      <a class="brand-mark" href="${home}">${escapeHtml(t('common.brand'))}</a>
      <p class="brand-domain">maotaiworks.com</p>
    </div>
    <div class="site-header__right">
      <nav class="site-nav ai-page-nav"><a class="ai-page-nav__home" href="${home}">${escapeHtml(copy.backHome)}</a></nav>
      <div id="lang-switch"></div>
    </div>
  </header>
  <main class="arena">
    <header class="arena__head">
      <p class="arena__kicker">${escapeHtml(copy.kicker)}</p>
      <h1 class="arena__title">${escapeHtml(copy.title)}</h1>
      <p class="arena__lead">${escapeHtml(copy.lead)}</p>
      <p class="arena__updated" data-updated hidden></p>
    </header>

    <div data-arena-host></div>

    <section class="arena__report" data-report hidden></section>
    <p class="arena__error" data-error hidden>${escapeHtml(copy.loadFailed)}</p>
  </main>
  <footer class="site-footer">
    <div class="footer-left"><p class="footer-brand">${escapeHtml(t('common.brand'))}</p></div>
    <p class="footer-meta">
      <a href="${home}">${escapeHtml(copy.backHome)}</a>
      <span aria-hidden="true">·</span>
      <a href="${localizedHref('/legal/')}#terms">${escapeHtml(t('common.terms'))}</a>
      <span aria-hidden="true">·</span>
      <a href="${localizedHref('/legal/')}#privacy">${escapeHtml(t('common.privacy'))}</a>
      <span aria-hidden="true">·</span>
      <span>© ${year} ${escapeHtml(t('common.copyright'))}</span>
    </p>
  </footer>
`
mountLanguageSwitcher(document.getElementById('lang-switch'))

const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
const boardName = (k: string) => copy.boards[k] ?? ex.ui.boards[k] ?? k

// ---------- report ----------
function fmtCi(r: { score: number; ciUp: number; ciDown: number }) {
  return r.ciUp === r.ciDown ? `${r.score} ±${r.ciUp}` : `${r.score} +${r.ciUp}/−${r.ciDown}`
}
function renderReport(b: BattleResult) {
  const el = $('[data-report]')
  const name = (s: Side) => escapeHtml(s === 'left' ? b.left.label : b.right.label)
  const rows = b.rounds.map((r, i) => {
    const res = r.kind === 'block' ? copy.block : r.kind === 'crit' ? copy.crit : copy.hit
    const upd = r.board.leaderboardUpdated ? ` · ${escapeHtml(r.board.leaderboardUpdated)}` : ''
    return `<tr>
      <td>${i + 1}. ${escapeHtml(boardName(r.board.key))}</td>
      <td>${fmtCi(r.left)}<small>${r.left.votes.toLocaleString()}</small></td>
      <td>${fmtCi(r.right)}<small>${r.right.votes.toLocaleString()}</small></td>
      <td>${r.delta}</td>
      <td>${r.threshold}</td>
      <td class="is-${r.kind}">${name(r.attacker)} · ${escapeHtml(res)}</td>
      <td>${r.damage}</td>
      <td><a href="${escapeHtml(r.board.url)}" target="_blank" rel="noopener">${escapeHtml(r.board.source)}</a><small>${escapeHtml(copy.updated.replace('{time}', formatBeijingTime(r.board.fetchedAt) ?? r.board.fetchedAt))}${upd}</small></td>
    </tr>`
  }).join('')
  const last = b.rounds[b.rounds.length - 1].hpAfter
  const result = b.winner ? fill(copy.winner, { name: b.winner === 'left' ? b.left.label : b.right.label }) : copy.draw
  el.innerHTML = `
    <h2 class="arena__report-title">${escapeHtml(copy.report)} · ${escapeHtml(result)}</h2>
    <p class="arena__report-sum">${escapeHtml(copy.hpLeft)}：${name('left')} ${last.left} · ${name('right')} ${last.right}</p>
    <p class="arena__report-sum">${escapeHtml(ex.predict)}：${name('left')} ${fill(ex.predictLine, { left: Math.round(predictLeft(b) * 100), right: 100 - Math.round(predictLeft(b) * 100) })} ${name('right')}<small>${escapeHtml(ex.predictNote)}</small></p>
    <details class="arena__details" open>
      <summary>${escapeHtml(copy.reportToggle)}</summary>
      <div class="arena__table-wrap"><table class="arena__table">
        <thead><tr>
          <th>${escapeHtml(copy.colBoard)}</th>
          <th>${name('left')}<small>${escapeHtml(copy.colScore)} · ${escapeHtml(copy.colVotes)}</small></th>
          <th>${name('right')}<small>${escapeHtml(copy.colScore)} · ${escapeHtml(copy.colVotes)}</small></th>
          <th>${escapeHtml(copy.colDelta)}</th>
          <th>${escapeHtml(copy.colThreshold)}</th>
          <th>${escapeHtml(copy.colResult)}</th>
          <th>${escapeHtml(copy.colDamage)}</th>
          <th>${escapeHtml(copy.colSource)}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <h3>${escapeHtml(copy.methodTitle)}</h3>
      <p>${escapeHtml(copy.method)}</p>
      <p>${escapeHtml(copy.sourceNote)}</p>
    </details>`
  el.hidden = false
}


mountArena($('[data-arena-host]'), {
  onStart: () => { $('[data-report]').hidden = true },
  onResult: renderReport,
  onError: () => { $('[data-error]').hidden = false },
  onData: (d) => {
    const upd = $('[data-updated]')
    upd.textContent = fill(copy.updated, { time: formatBeijingTime(d.updatedAt) ?? d.updatedAt })
    upd.hidden = false
  },
})

trackView('arena')
