import '../styles/main.css'
import '../ai-daily/board.css'
import '../ai-skills/board.css'
import '../arena/promo.css'
import { trackView } from '../analytics'
import { initLocale, localizedHref, t } from '../i18n'
import { mountLanguageSwitcher } from '../i18n/switcher'
import {
  aiCopy,
  formatUpdatedLine,
  mountAiBoards,
  observeAiBoards,
  renderAiRailItems,
  scrollToAiBoard,
} from '../ai-daily/render'
import { mountAiSkills, renderSkillsRailItem } from '../ai-skills/render'

initLocale()
const copy = aiCopy()
document.title = copy.metaTitle
document.querySelector('meta[name="description"]')?.setAttribute('content', copy.metaDescription)

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] as string))
}

const root = document.getElementById('ai-root')
if (!root) throw new Error('ai-root missing')

const home = localizedHref('/')
const year = String(new Date().getFullYear())

root.innerHTML = `
  <aside class="app-rail" id="app-rail" aria-label="${escapeHtml(copy.pageTitle)}">
    <nav class="app-rail__nav" id="app-rail-nav">
      ${renderAiRailItems(renderSkillsRailItem())}
      <a class="app-rail__item app-rail__item--home" href="${home}"><span>${escapeHtml(copy.railHome)}</span></a>
    </nav>
  </aside>

  <header class="site-header">
    <div class="brand-block">
      <a class="brand-mark" href="${home}">${escapeHtml(t('common.brand'))}</a>
      <p class="brand-domain">maotaiworks.com</p>
    </div>
    <div class="site-header__right">
      <nav class="site-nav ai-page-nav" aria-label="${escapeHtml(copy.pageTitle)}">
        <a class="ai-page-nav__home" href="${home}">${escapeHtml(copy.backHome)}</a>
      </nav>
      <div id="lang-switch"></div>
    </div>
  </header>

  <main>
    <header class="ai-page">
      <p class="ai-board__kicker">${escapeHtml(copy.newsKicker)}</p>
      <h1 class="ai-page__title">${escapeHtml(copy.pageTitle)}</h1>
      <p class="ai-page__lead">${escapeHtml(copy.pageLead)}</p>
      <p class="ai-page__updated" data-ai-page-updated hidden></p>
      <p class="ai-intro ai-page__intro" data-ai-page-intro hidden></p>
    </header>
    <div id="ai-boards"></div>
    <div id="ai-skills-board"></div>
  </main>

  <footer class="site-footer">
    <div class="footer-left">
      <p class="footer-brand">${escapeHtml(t('common.brand'))}</p>
    </div>
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

function highlightRail(id: string | null) {
  document.querySelectorAll<HTMLElement>('.app-rail__item[data-rail-id]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.railId === id)
  })
}

document.querySelector('#app-rail-nav')?.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-rail-id]')
  if (!btn?.dataset.railId) return
  if (scrollToAiBoard(btn.dataset.railId)) highlightRail(btn.dataset.railId)
})

const skillsHost = document.getElementById('ai-skills-board')
const skillsReady = skillsHost ? mountAiSkills(skillsHost, 'page') : Promise.resolve(null)

const host = document.getElementById('ai-boards')
if (host) {
  void mountAiBoards(host, 'page').then((issue) => {
    observeAiBoards(highlightRail)
    if (!issue) return
    const updated = document.querySelector<HTMLElement>('[data-ai-page-updated]')
    if (updated) {
      updated.textContent = formatUpdatedLine(issue.updatedAt)
      updated.hidden = false
    }
    const intro = document.querySelector<HTMLElement>('[data-ai-page-intro]')
    if (intro && issue.intro) {
      intro.textContent = issue.intro
      intro.hidden = false
    }
    // Honour #ai-usable / #ai-news / #ai-skills from the homepage "see all" links
    // once both boards have rendered (the skills board sits below the others).
    void skillsReady.then(() => {
      const hash = decodeURIComponent(location.hash.slice(1))
      if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' })
    })
  })
}

trackView('ai-daily')
