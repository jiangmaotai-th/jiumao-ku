import './styles/main.css'
import {
  filterCatalog,
  type CatalogItem,
  type DownloadLink,
  type FilterTab,
} from './data/apps'
import {
  applyDocumentMeta,
  applyDomI18n,
  initLocale,
  t,
  tList,
} from './i18n'
import { mountLanguageSwitcher } from './i18n/switcher'
import { initVisitorCounter } from './visitor'

initLocale()
applyDocumentMeta()
applyDomI18n()
mountLanguageSwitcher(document.getElementById('lang-switch'))

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

function linkLabel(link: DownloadLink): string {
  if (link.platform === 'web' || link.openInPlace) return t('common.openOnline')
  return link.label
}

function renderDownloads(links: DownloadLink[]): string {
  return links
    .map((link) => {
      const available = link.available !== false
      const label = linkLabel(link)
      if (!available) {
        return `
      <span
        class="download-btn download-btn--disabled"
        aria-disabled="true"
        title="${t('common.unavailable')}"
      >
        ${platformIcon(link.platform)}
        <span>${label}</span>
      </span>`
      }

      const downloadAttr =
        !link.openInPlace && link.filename ? ` download="${link.filename}"` : ''
      const primary = link.openInPlace ? ' download-btn--primary' : ''
      return `
      <a
        class="download-btn${primary}"
        href="${link.href}"${downloadAttr}
      >
        ${platformIcon(link.platform)}
        <span>${label}</span>
      </a>`
    })
    .join('')
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

function renderSummary(summary: string[], privacy?: string): string {
  const first = summary.find((p) => p.trim()) || ''
  const blurb = first
    ? `<p class="item-blurb" title="${first.replace(/"/g, '&quot;')}">${first}</p>`
    : ''
  const privacyLine = privacy
    ? `<p class="item-privacy">${LOCAL_MARK}<span>${privacy}</span></p>`
    : ''
  return `${blurb}${privacyLine}`
}

function formatStoreUpdateStamp(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleString(undefined, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return t('store.dailyBadge', { time })
}

function renderItem(item: CatalogItem, storeUpdatedAt?: string | null): string {
  const copy = catalogCopy(item.id)
  const stamp =
    item.id === 'store-price' ? formatStoreUpdateStamp(storeUpdatedAt) : ''
  const stampHtml = stamp ? `<p class="item-stamp">${stamp}</p>` : ''
  return `
    <article class="catalog-item" role="listitem" data-category="${item.category}" data-app-id="${item.id}">
      <div class="item-copy">
        <h3 class="item-name">${copy.name}</h3>
        ${stampHtml}
        ${renderSummary(copy.summary, copy.privacy)}
      </div>
      <div class="item-downloads">
        ${renderDownloads(item.downloads)}
      </div>
    </article>`
}

function renderList(
  container: HTMLElement,
  items: CatalogItem[],
  emptyText: string,
  storeUpdatedAt?: string | null,
) {
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">${emptyText}</p>`
    return
  }
  container.innerHTML = items.map((item) => renderItem(item, storeUpdatedAt)).join('')
}

function isFilterTab(value: string): value is FilterTab {
  return value === 'all' || value === 'software' || value === 'game' || value === 'other'
}

const catalogList = document.querySelector<HTMLElement>('#catalog-list')
const categoryNav = document.querySelector<HTMLElement>('#category-nav')
const yearEl = document.querySelector<HTMLElement>('#year')
let activeTab: FilterTab = 'all'
let storeUpdatedAt: string | null = null

function applyFilter(tab: FilterTab) {
  activeTab = tab
  categoryNav?.querySelectorAll<HTMLButtonElement>('.cat-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.filter === tab)
  })
  if (catalogList) {
    renderList(catalogList, filterCatalog(tab), emptyHint(tab), storeUpdatedAt)
  }
}

categoryNav?.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.cat-btn')
  if (!target?.dataset.filter || !isFilterTab(target.dataset.filter)) return
  applyFilter(target.dataset.filter)
})

applyFilter(activeTab)

void fetch('/api/store/home')
  .then((r) => (r.ok ? r.json() : null))
  .then((data: { updatedAt?: string | null } | null) => {
    if (!data?.updatedAt) return
    storeUpdatedAt = data.updatedAt
    applyFilter(activeTab)
  })
  .catch(() => {})

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear())
}

void initVisitorCounter(document.querySelector<HTMLElement>('#visitor-count'))
