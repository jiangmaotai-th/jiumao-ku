import './styles/main.css'
import './ai-daily/board.css'
import './ai-skills/board.css'
import './arena/promo.css'
import { mountArenaPromo } from './arena/data'
import { trackDownload, trackView } from './analytics'
import {
  filterCatalog,
  type CatalogItem,
  type DownloadLink,
  type FilterTab,
} from './data/apps'
import {
  applyDocumentMeta,
  applyDomI18n,
  getLocale,
  initLocale,
  localizedHref,
  t,
  tList,
} from './i18n'
import { mountLanguageSwitcher } from './i18n/switcher'
import {
  mountAiBoards,
  observeAiBoards,
  renderAiRailItems,
  pairNewsWithSkills,
  AI_HOME_LIMIT,
  scrollToAiBoard,
} from './ai-daily/render'
import { mountAiSkills, renderSkillsRailItem } from './ai-skills/render'
import { pingSiteVisit } from './visitor'

initLocale()
applyDocumentMeta()
applyDomI18n()
mountLanguageSwitcher(document.getElementById('lang-switch'))
mountSiteNotice()

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] as string))
}

function mountSiteNotice() {
  const track = document.querySelector<HTMLElement>('[data-notice-track]')
  const bar = document.querySelector<HTMLElement>('.site-notice')
  if (!track || !bar) return
  const items = tList('home.notices').map((item) => item.trim()).filter(Boolean)
  if (!items.length) {
    bar.hidden = true
    return
  }
  const line = items.map((item) => {
    const text = item.replace(/[。．.]+$/u, '')
    return `<span>${escapeHtml(t('home.noticeQuote', { text }))}</span>`
  }).join('')
  track.innerHTML = `<p class="site-notice__copy">${line}</p>`
}

function emptyHint(tab: FilterTab): string {
  if (tab === 'software') return t('home.emptySoftware')
  if (tab === 'game') return t('home.emptyGame')
  if (tab === 'other') return t('home.emptyOther')
  return t('home.emptyAll')
}

const platformIcon = (platform: DownloadLink['platform']): string => {
  if (platform === 'web') {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.3A6.7 6.7 0 1 0 8 14.7 6.7 6.7 0 0 0 8 1.3Zm0 1.2c.9 0 2.3 1.7 2.7 4H5.3c.4-2.3 1.8-4 2.7-4Zm-3.3 5h5.6c-.1.7-.3 1.4-.5 2H5.2c-.2-.6-.4-1.3-.5-2Zm.6 3h4.4c-.5 1.7-1.5 2.8-2.2 2.8S5.8 12.2 5.3 10.5Zm5.4-7.2c.9 1.3 1.5 3 1.7 4.7h2.1A5.45 5.45 0 0 0 10.7 3.3Zm2.9 5.9h-2c.2.7.3 1.4.3 2.1 0 .5 0 1-.1 1.5a5.46 5.46 0 0 0 1.8-3.6ZM5.3 3.3A5.45 5.45 0 0 0 1.7 8h2.1c.2-1.7.8-3.4 1.7-4.7Zm-2 5.9a5.46 5.46 0 0 0 1.8 3.6c-.1-.5-.1-1-.1-1.5 0-.7.1-1.4.3-2.1h-2Z"/></svg>`
  }
  if (platform === 'windows') {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M0 2.2 6.6 1.3v6.1H0zm7.4-.9L16 0v7.4H7.4zM0 8.6h6.6v6.1L0 13.8zm7.4 0H16V16l-8.6-1.2z"/></svg>`
  }
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M11.2 8.3c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.13-2.5.76-3.15.76-.66 0-1.67-.74-2.75-.72-1.41.02-2.72.82-3.45 2.08-1.48 2.56-.38 6.35 1.06 8.43.7 1.02 1.54 2.16 2.64 2.12 1.06-.04 1.46-.68 2.74-.68 1.27 0 1.63.68 2.76.66 1.14-.02 1.86-1.02 2.55-2.05.8-1.17 1.13-2.3 1.15-2.36-.02-.01-2.2-.84-2.22-3.34zM9.6 2.9c.57-.69.96-1.65.85-2.6-.82.03-1.81.55-2.4 1.24-.53.61-.99 1.59-.87 2.52.92.07 1.86-.47 2.42-1.16z"/></svg>`
}

function desktopLabel(link: DownloadLink): string {
  if (link.platform === 'mac') return 'macOS'
  if (link.platform === 'windows') return 'Windows'
  return link.label
}

function renderDesktopMenuItem(link: DownloadLink): string {
  const available = link.available !== false
  const label = desktopLabel(link)
  if (!available) {
    return `
      <span class="desktop-menu__item desktop-menu__item--soon" aria-disabled="true" title="${t('common.unavailable')}">
        ${platformIcon(link.platform)}
        <span>${label}</span>
        <em>${t('common.comingSoon')}</em>
      </span>`
  }
  const downloadAttr = link.filename ? ` download="${link.filename}"` : ''
  return `
    <a
      class="desktop-menu__item"
      href="${link.href}"${downloadAttr}
      data-track="download"
      data-platform="${link.platform}"
    >
      ${platformIcon(link.platform)}
      <span>${label}</span>
    </a>`
}

function renderDownloads(links: DownloadLink[]): string {
  const web = links.find((l) => l.platform === 'web' || l.openInPlace)
  const desktop = links.filter((l) => l.platform === 'mac' || l.platform === 'windows')

  const webHtml = web
    ? `
    <a
      class="action-web"
      href="${localizedHref(web.href)}"
      data-track="download"
      data-platform="web"
    >
      <svg class="action-web__logo" viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M8 1.3A6.7 6.7 0 1 0 8 14.7 6.7 6.7 0 0 0 8 1.3Zm0 1.2c.9 0 2.3 1.7 2.7 4H5.3c.4-2.3 1.8-4 2.7-4Zm-3.3 5h5.6c-.1.7-.3 1.4-.5 2H5.2c-.2-.6-.4-1.3-.5-2Zm.6 3h4.4c-.5 1.7-1.5 2.8-2.2 2.8S5.8 12.2 5.3 10.5Zm5.4-7.2c.9 1.3 1.5 3 1.7 4.7h2.1A5.45 5.45 0 0 0 10.7 3.3Zm2.9 5.9h-2c.2.7.3 1.4.3 2.1 0 .5 0 1-.1 1.5a5.46 5.46 0 0 0 1.8-3.6ZM5.3 3.3A5.45 5.45 0 0 0 1.7 8h2.1c.2-1.7.8-3.4 1.7-4.7Zm-2 5.9a5.46 5.46 0 0 0 1.8 3.6c-.1-.5-.1-1-.1-1.5 0-.7.1-1.4.3-2.1h-2Z"/>
      </svg>
      <span>${t('common.openOnline')}</span>
    </a>`
    : ''

  const desktopHtml =
    desktop.length > 0
      ? `
    <div class="desktop-icon">
      <button type="button" class="desktop-icon__btn" aria-label="${t('common.downloadDesktop')}" aria-expanded="false" aria-haspopup="true">
        <span class="desktop-icon__marks" aria-hidden="true">
          ${platformIcon('mac')}
          ${platformIcon('windows')}
        </span>
      </button>
      <div class="desktop-menu" role="menu" hidden>
        ${desktop.map(renderDesktopMenuItem).join('')}
      </div>
    </div>`
      : ''

  return `
    <div class="action-row${web ? '' : ' action-row--desktop-only'}">
      ${webHtml}
      ${desktopHtml}
    </div>`
}

const LOCAL_MARK = `<span class="local-mark" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.35"/><path d="M5 14.2h6M8 11.5v2.7" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><circle cx="8" cy="7" r="1.35" fill="currentColor"/></svg></span>`

function catalogCopy(id: string) {
  const name = t(`catalog.${id}.name`)
  const summary = tList(`catalog.${id}.summary`)
  const privacy = t(`catalog.${id}.privacy`)
  return {
    name: name.startsWith('catalog.') ? id : name,
    summary,
    privacy: privacy.startsWith('catalog.') ? '' : privacy,
  }
}

function navLabelFor(item: CatalogItem): string {
  const locale = getLocale()
  if (item.navLabel && (locale === 'zh-CN' || locale === 'zh-TW')) {
    return item.navLabel
  }
  const name = catalogCopy(item.id).name
  return name.length > 9 ? `${name.slice(0, 9)}…` : name
}

function renderRail(items: CatalogItem[]) {
  const nav = document.querySelector<HTMLElement>('#app-rail-nav')
  const rail = document.querySelector<HTMLElement>('#app-rail')
  if (!nav || !rail) return
  rail.hidden = false
  nav.innerHTML = renderAiRailItems(renderSkillsRailItem()) + items
    .map((item) => {
      const full = catalogCopy(item.id).name
      const short = navLabelFor(item)
      return `<button
        type="button"
        class="app-rail__item"
        data-rail-id="${item.id}"
        title="${full}"
        aria-label="${full}"
      ><span>${short}</span></button>`
    })
    .join('')
}

function highlightRail(appId: string | null) {
  document.querySelectorAll<HTMLButtonElement>('.app-rail__item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.railId === appId)
  })
}

function scrollToApp(appId: string) {
  if (scrollToAiBoard(appId)) {
    highlightRail(appId)
    return
  }
  const card = document.querySelector<HTMLElement>(
    `#catalog-list .catalog-item[data-app-id="${appId}"]`,
  )
  if (!card) return
  highlightRail(appId)
  card.classList.add('is-rail-target')
  card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => card.classList.remove('is-rail-target'), 1200)
}

let railObserver: IntersectionObserver | null = null

function observeCatalogCards() {
  railObserver?.disconnect()
  const cards = document.querySelectorAll<HTMLElement>(
    '#catalog-list .catalog-item[data-app-id]',
  )
  if (!cards.length) {
    highlightRail(null)
    return
  }
  railObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      const top = visible[0]?.target
      if (top instanceof HTMLElement && top.dataset.appId) {
        highlightRail(top.dataset.appId)
      }
    },
    {
      root: null,
      threshold: [0.25, 0.45, 0.65],
      rootMargin: '-20% 0px -35% 0px',
    },
  )
  cards.forEach((card) => railObserver?.observe(card))
}

function renderSummary(summary: string[], privacy?: string): string {
  const blocks = summary.map(
    (p) => `<p class="item-summary">${p}</p>`,
  )
  if (privacy) {
    blocks.push(
      `<p class="item-summary item-summary--privacy">${LOCAL_MARK}${privacy}</p>`,
    )
  }
  return blocks.join('')
}

function formatStoreUpdatedAt(iso?: string | null): string {
  if (!iso) return t('store.none')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return t('store.none')
  return d.toLocaleString(getLocale(), {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

let storeUpdatedAtCache: string | null | undefined

async function hydrateStoreUpdatedAt() {
  const slots = document.querySelectorAll<HTMLElement>('[data-store-updated]')
  if (slots.length === 0) return
  if (storeUpdatedAtCache === undefined) {
    try {
      const res = await fetch('/api/store/home')
      if (!res.ok) throw new Error(`http_${res.status}`)
      const data = (await res.json()) as { updatedAt?: string | null }
      storeUpdatedAtCache = data.updatedAt ?? null
    } catch {
      storeUpdatedAtCache = null
    }
  }
  const text = formatStoreUpdatedAt(storeUpdatedAtCache)
  slots.forEach((slot) => {
    const value = slot.querySelector<HTMLElement>('.item-updated-value')
    if (value) value.textContent = text
    slot.hidden = false
  })
}

function renderItem(item: CatalogItem): string {
  const copy = catalogCopy(item.id)
  const playHref = localizedHref(item.downloads.find((link) => link.openInPlace)?.href || item.downloads[0]?.href || '#')
  const cover = item.cover
    ? `<a class="item-cover" href="${playHref}" data-track="download" data-platform="web" aria-hidden="true" tabindex="-1">
        <img src="${item.cover}" alt="">
        <span class="item-cover-badge">${t('home.filterGame')}</span>
      </a>`
    : ''
  const updatedLine =
    item.id === 'store-price'
      ? `<p class="item-updated" data-store-updated hidden>
          <span class="item-updated-label">${t('store.updatedAtLabel')}</span>
          <strong class="item-updated-value">${t('common.loading')}</strong>
        </p>`
      : ''
  return `
    <article class="catalog-item${item.cover ? ' is-game' : ''}" role="listitem" data-category="${item.category}" data-app-id="${item.id}">
      ${cover}
      <div class="item-copy">
        <h3 class="item-name">${copy.name}</h3>
        ${renderSummary(copy.summary, copy.privacy)}
        ${updatedLine}
      </div>
      <div class="item-downloads">
        ${renderDownloads(item.downloads)}
      </div>
    </article>`
}

function renderList(container: HTMLElement, items: CatalogItem[], emptyText: string) {
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">${emptyText}</p>`
    renderRail([])
    return
  }
  container.innerHTML = items.map(renderItem).join('')
  renderRail(items)
  observeCatalogCards()
  void hydrateStoreUpdatedAt()
}

function isFilterTab(value: string): value is FilterTab {
  return value === 'all' || value === 'software' || value === 'game' || value === 'other'
}

const catalogList = document.querySelector<HTMLElement>('#catalog-list')
const categoryNav = document.querySelector<HTMLElement>('#category-nav')
const yearEl = document.querySelector<HTMLElement>('#year')
let activeTab: FilterTab = 'all'

function applyFilter(tab: FilterTab) {
  activeTab = tab
  categoryNav?.querySelectorAll<HTMLButtonElement>('.cat-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.filter === tab)
  })
  if (catalogList) {
    renderList(catalogList, filterCatalog(tab), emptyHint(tab))
  }
}

categoryNav?.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.cat-btn')
  if (!target?.dataset.filter || !isFilterTab(target.dataset.filter)) return
  applyFilter(target.dataset.filter)
})

document.querySelector('#app-rail-nav')?.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.app-rail__item')
  if (!btn?.dataset.railId) return
  scrollToApp(btn.dataset.railId)
})

function closeAllDesktopMenus(except?: HTMLElement) {
  document.querySelectorAll<HTMLElement>('.desktop-icon.is-open').forEach((node) => {
    if (except && node === except) return
    node.classList.remove('is-open')
    const btn = node.querySelector<HTMLButtonElement>('.desktop-icon__btn')
    const menu = node.querySelector<HTMLElement>('.desktop-menu')
    if (btn) btn.setAttribute('aria-expanded', 'false')
    if (menu) menu.hidden = true
  })
}

catalogList?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const desktopBtn = target.closest<HTMLButtonElement>('.desktop-icon__btn')
  if (desktopBtn) {
    event.preventDefault()
    const wrap = desktopBtn.closest<HTMLElement>('.desktop-icon')
    const menu = wrap?.querySelector<HTMLElement>('.desktop-menu')
    if (!wrap || !menu) return
    const willOpen = !wrap.classList.contains('is-open')
    closeAllDesktopMenus(wrap)
    wrap.classList.toggle('is-open', willOpen)
    desktopBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false')
    menu.hidden = !willOpen
    return
  }

  const link = target.closest<HTMLAnchorElement>('a[data-track="download"]')
  if (!link) return
  closeAllDesktopMenus()
  const item = link.closest<HTMLElement>('[data-app-id]')
  const appId = item?.dataset.appId
  if (!appId) return
  trackDownload(appId, link.dataset.platform || link.textContent?.trim() || undefined)
})

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.desktop-icon')) closeAllDesktopMenus()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAllDesktopMenus()
})

// Mount the skills frame first (synchronously) so observeAiBoards below sees it too.
const aiSkillsHost = document.querySelector<HTMLElement>('#ai-skills-board')
const aiBoardsHost = document.querySelector<HTMLElement>('#ai-boards')
// zh-CN: 「中国大陆能用的 AI」|「AI 大事」side by side, skills below.
// Other locales: 「AI 大事」|「AI 最新 Skill」side by side, each capped.
const aiPaired = pairNewsWithSkills(aiBoardsHost, aiSkillsHost)
mountArenaPromo(document.querySelector<HTMLElement>('#ai-boards'))
if (aiSkillsHost) void mountAiSkills(aiSkillsHost, 'home', aiPaired ? AI_HOME_LIMIT : Infinity)

if (aiBoardsHost) {
  void mountAiBoards(aiBoardsHost, 'home').then(() => {
    observeAiBoards((id) => highlightRail(id))
  })
}

applyFilter(activeTab)

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear())
}

trackView('home')
pingSiteVisit()
