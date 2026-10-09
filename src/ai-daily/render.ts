import { loadLatestAiDaily, formatUpdatedAt } from './issue'
import {
  AI_DAILY_ACCESS_LABEL,
  AI_DAILY_CATEGORIES,
  type AiDailyIssue,
  type AiDailyItem,
} from './types'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return escapeHtml(parsed.href)
  } catch {
    return null
  }
}

function renderSource(item: AiDailyItem): string {
  const href = safeHref(item.sourceUrl)
  const name = escapeHtml(item.sourceName || '来源')
  if (!href) return `<span class="ai-source">${name}</span>`
  return `<a class="ai-source" href="${href}" target="_blank" rel="noopener noreferrer">${name}</a>`
}

function renderItemTitle(item: AiDailyItem, tag: 'h3' | 'h4'): string {
  const title = escapeHtml(item.title)
  const href = safeHref(item.sourceUrl)
  if (!href) return `<${tag} class="ai-item__title">${title}</${tag}>`
  return `<${tag} class="ai-item__title"><a href="${href}" target="_blank" rel="noopener noreferrer">${title}</a></${tag}>`
}

function renderAccess(item: AiDailyItem): string {
  const label = AI_DAILY_ACCESS_LABEL[item.access]
  const note = item.accessNote
    ? `<span class="ai-access__note">${escapeHtml(item.accessNote)}</span>`
    : ''
  return `<span class="ai-access ai-access--${item.access}">${label}</span>${note}`
}

function renderUsableItem(item: AiDailyItem): string {
  return `
    <li class="ai-item">
      <div class="ai-item__copy">
        ${renderItemTitle(item, 'h3')}
        <p class="ai-item__summary">${escapeHtml(item.summary)}</p>
      </div>
      <div class="ai-item__meta">
        ${renderSource(item)}
        ${renderAccess(item)}
      </div>
    </li>`
}

function renderNewsItem(item: AiDailyItem): string {
  return `
    <li class="ai-item">
      <div class="ai-item__copy">
        ${renderItemTitle(item, 'h4')}
        <p class="ai-item__summary">${escapeHtml(item.summary)}</p>
      </div>
      <div class="ai-item__meta">
        ${renderSource(item)}
      </div>
    </li>`
}

export function renderUsableBody(issue: AiDailyIssue): string {
  const items = issue.items.filter((item) => item.usable)
  if (items.length === 0) {
    return `<p class="ai-empty">今天还没有可以直接上手的条目。</p>`
  }
  return `<ol class="ai-list">${items.map(renderUsableItem).join('')}</ol>`
}

export function renderNewsBody(issue: AiDailyIssue, options?: { intro?: boolean }): string {
  const groups = AI_DAILY_CATEGORIES.map((category) => ({
    category,
    items: issue.items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  if (groups.length === 0) {
    const text =
      options?.intro === false ? '今天的日报还在整理' : issue.intro || '今天的日报还在整理'
    return `<p class="ai-empty">${escapeHtml(text)}</p>`
  }

  const intro =
    options?.intro === false || !issue.intro
      ? ''
      : `<p class="ai-intro">${escapeHtml(issue.intro)}</p>`
  const sections = groups
    .map(
      (group) => `
      <section class="ai-group">
        <h3 class="ai-group__title">${escapeHtml(group.category)}</h3>
        <ol class="ai-list">${group.items.map(renderNewsItem).join('')}</ol>
      </section>`,
    )
    .join('')
  return `${intro}<div class="ai-groups">${sections}</div>`
}

function setText(root: ParentNode, selector: string, text: string) {
  const el = root.querySelector(selector)
  if (el) el.textContent = text
}

export async function mountAiDaily(root: ParentNode = document): Promise<void> {
  const usable = root.querySelector<HTMLElement>('#ai-usable [data-ai-body]')
  const news = root.querySelector<HTMLElement>('#ai-news [data-ai-body]')
  if (!usable && !news) return

  try {
    const issue = await loadLatestAiDaily()
    const updated = formatUpdatedAt(issue.updatedAt)
    const pageHasIntro = Boolean(root.querySelector('[data-ai-intro]'))
    if (usable) usable.innerHTML = renderUsableBody(issue)
    if (news) news.innerHTML = renderNewsBody(issue, { intro: !pageHasIntro })
    setText(root, '[data-ai-updated]', updated)
    setText(root, '[data-ai-intro]', issue.intro)
  } catch {
    const message = '日报暂时没有加载出来。'
    if (usable) usable.innerHTML = `<p class="ai-empty">${message}</p>`
    if (news) news.innerHTML = `<p class="ai-empty">${message}</p>`
  }
}
