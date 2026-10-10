import { getLocale, localizedHref } from '../i18n'
import { aiDailyMessages, type AiDailyMessages } from '../i18n/aiDaily'
import { loadLatestAiDaily } from './issue'
import { renderArenaRailItem } from '../arena/data'
import { loadLatestAiSkills } from '../ai-skills/issue'
import { aiSkillsMessages } from '../i18n/aiSkills'
import type { AiSkillItem } from '../ai-skills/types'
import {
  AI_DAILY_CATEGORIES,
  AI_DAILY_PAGE_PATH,
  type AiDailyIssue,
  type AiDailyItem,
} from './types'

export type AiBoardsVariant = 'home' | 'page'

/** Section ids shared by the homepage and /ai/ (rail + anchors use them). */
export const AI_USABLE_ID = 'ai-usable'
export const AI_NEWS_ID = 'ai-news'

export function aiCopy(): AiDailyMessages {
  return aiDailyMessages[getLocale()] ?? aiDailyMessages['zh-CN']
}

function fill(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] as string))
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

/** Beijing wall time of the JSON `updatedAt`, e.g. 2026年10月9日 08:22. */
export function formatBeijingTime(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const locale = getLocale()
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>
  const { year, month, day, minute } = parts
  const hour = parts.hour === '24' ? '00' : parts.hour
  if (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja') {
    return `${year}年${month}月${day}日 ${hour}:${minute}`
  }
  if (locale === 'ko') return `${year}년 ${month}월 ${day}일 ${hour}:${minute}`
  return new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-latn`, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function formatUpdatedLine(iso: string): string {
  const copy = aiCopy()
  return fill(copy.updated, { time: formatBeijingTime(iso) ?? '—' })
}

const EXTERNAL_MARK = `<svg class="ai-ext" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4.5 2.5h5v5M9.3 2.7 3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

function renderSource(item: AiDailyItem): string {
  const copy = aiCopy()
  const href = safeHref(item.sourceUrl)
  const name = escapeHtml(item.sourceName || copy.source)
  const label = `<span class="ai-source__label">${escapeHtml(copy.source)}</span>`
  if (!href) return `<span class="ai-source">${label}${name}</span>`
  return `<a class="ai-source" href="${href}" target="_blank" rel="noopener noreferrer">${label}${name}${EXTERNAL_MARK}</a>`
}

function renderTitle(item: AiDailyItem, tag: 'h3' | 'h4', cls: string): string {
  const title = escapeHtml(item.title)
  const href = safeHref(item.sourceUrl)
  if (!href) return `<${tag} class="${cls}">${title}</${tag}>`
  return `<${tag} class="${cls}"><a href="${href}" target="_blank" rel="noopener noreferrer">${title}</a></${tag}>`
}

function renderAccess(item: AiDailyItem): string {
  const copy = aiCopy()
  return `<span class="ai-access ai-access--${item.access}">${escapeHtml(copy.access[item.access])}</span>`
}

function renderUsableCard(item: AiDailyItem): string {
  const note = item.accessNote
    ? `<p class="ai-use-card__note">${escapeHtml(item.accessNote)}</p>`
    : ''
  return `
    <li class="ai-use-card">
      ${renderTitle(item, 'h3', 'ai-use-card__title')}
      <p class="ai-use-card__summary">${escapeHtml(item.summary)}</p>
      <div class="ai-use-card__foot">
        <div class="ai-use-card__access">${renderAccess(item)}${note}</div>
        ${renderSource(item)}
      </div>
    </li>`
}

function renderNewsItem(item: AiDailyItem): string {
  return `
    <li class="ai-news-item">
      <div class="ai-news-item__copy">
        ${renderTitle(item, 'h4', 'ai-news-item__title')}
        <p class="ai-news-item__summary">${escapeHtml(item.summary)}</p>
      </div>
      <div class="ai-news-item__meta">${renderSource(item)}</div>
    </li>`
}

/** Homepage shows only the first few items per column; "查看全部 →" goes to /ai/. */
export const AI_HOME_LIMIT = 5
/** zh-CN board is「中国大陆能用的 AI」: below this many direct items, top up with direct skills. */
export const AI_DIRECT_MIN = 3

/** zh-CN: strictly access=direct AND usable. Other locales: usable (original「今天就能用」). */
export function isStrictDirectLocale(): boolean {
  return getLocale() === 'zh-CN'
}

export function usableItems(issue: AiDailyIssue): AiDailyItem[] {
  return isStrictDirectLocale()
    ? issue.items.filter((item) => item.usable && item.access === 'direct')
    : issue.items.filter((item) => item.usable)
}

/** Direct-access skills used to top up the zh-CN board; never anything else. */
export function directSkillFill(skills: AiSkillItem[] | null, have: number): AiSkillItem[] {
  if (!isStrictDirectLocale() || !skills || have >= AI_DIRECT_MIN) return []
  return skills.filter((s) => s.access === 'direct').slice(0, AI_DIRECT_MIN - have)
}

function renderSkillFillCard(skill: AiSkillItem): string {
  const copy = aiCopy()
  const type = (aiSkillsMessages[getLocale()] ?? aiSkillsMessages['zh-CN']).sourceTypes[skill.sourceType] ?? skill.sourceType
  const asItem = {
    title: skill.name,
    summary: skill.summary,
    sourceUrl: skill.sourceUrl,
    sourceName: skill.sourceName,
    access: 'direct',
  } as AiDailyItem
  const note = skill.accessNote ? `<p class="ai-use-card__note">${escapeHtml(skill.accessNote)}</p>` : ''
  return `
    <li class="ai-use-card ai-use-card--skill">
      <p class="ai-use-card__from">${escapeHtml(copy.skillFill)} · ${escapeHtml(skill.platform)} · ${escapeHtml(type)}</p>
      ${renderTitle(asItem, 'h3', 'ai-use-card__title')}
      <p class="ai-use-card__summary">${escapeHtml(skill.summary)}</p>
      <div class="ai-use-card__foot">
        <div class="ai-use-card__access">${renderAccess(asItem)}${note}</div>
        ${renderSource(asItem)}
      </div>
    </li>`
}

export function renderUsableBody(
  issue: AiDailyIssue,
  skills: AiSkillItem[] | null = null,
  limit = Infinity,
): string {
  const items = usableItems(issue)
  const fill = directSkillFill(skills, items.length)
  const cards = [...items.map(renderUsableCard), ...fill.map(renderSkillFillCard)].slice(0, limit)
  if (cards.length === 0) return `<p class="ai-empty">${escapeHtml(aiCopy().usableEmpty)}</p>`
  return `<ol class="ai-use-grid">${cards.join('')}</ol>`
}

export function usableCount(issue: AiDailyIssue, skills: AiSkillItem[] | null): number {
  const n = usableItems(issue).length
  return n + directSkillFill(skills, n).length
}

export function renderNewsBody(issue: AiDailyIssue, withIntro: boolean, limit = Infinity): string {
  const copy = aiCopy()
  let left = limit
  const groups = AI_DAILY_CATEGORIES.map((category) => ({
    category,
    items: issue.items.filter((item) => item.category === category),
  }))
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const items = group.items.slice(0, Math.max(0, left))
      left -= items.length
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)

  if (groups.length === 0) return `<p class="ai-empty">${escapeHtml(copy.newsEmpty)}</p>`

  const intro = withIntro && issue.intro ? `<p class="ai-intro">${escapeHtml(issue.intro)}</p>` : ''
  const sections = groups
    .map(
      (group) => `
      <section class="ai-group">
        <h3 class="ai-group__title">${escapeHtml(copy.categories[group.category])}<span class="ai-group__count">${group.items.length}</span></h3>
        <ol class="ai-news-list">${group.items.map(renderNewsItem).join('')}</ol>
      </section>`,
    )
    .join('')
  return `${intro}<div class="ai-groups">${sections}</div>`
}

/** Static frame of both boards; bodies are filled once the JSON arrives. */
export function renderAiBoards(variant: AiBoardsVariant): string {
  const copy = aiCopy()
  const page = localizedHref(AI_DAILY_PAGE_PATH)
  const more = (hash: string) =>
    variant === 'home'
      ? `<a class="ai-board__more" href="${page}#${hash}">${escapeHtml(copy.viewAll)}</a>`
      : ''
  const titleText = (text: string, hash: string) =>
    variant === 'home' ? `<a href="${page}#${hash}">${escapeHtml(text)}</a>` : escapeHtml(text)
  const note = copy.contentNote
    ? `<p class="ai-board__note" data-ai-content-note hidden>${escapeHtml(copy.contentNote)}</p>`
    : ''
  const loading = `<p class="ai-empty">${escapeHtml(copy.loading)}</p>`

  const useBoard = isStrictDirectLocale()
    ? `
    <article class="ai-board ai-board--use" id="${AI_USABLE_ID}" data-rail-section="${AI_USABLE_ID}" aria-labelledby="${AI_USABLE_ID}-title">
      <header class="ai-board__head">
        <div class="ai-board__heading">
          <p class="ai-board__kicker">${escapeHtml(copy.usableKicker)}</p>
          <h2 class="ai-board__title" id="${AI_USABLE_ID}-title">${titleText(copy.usableTitle, AI_USABLE_ID)}<span class="ai-board__badge">${escapeHtml(copy.usableBadge)}</span><span class="ai-board__count" data-ai-usable-count hidden></span></h2>
          <p class="ai-board__lead">${escapeHtml(copy.usableLead)}</p>
          ${note}
        </div>
        ${more(AI_USABLE_ID)}
      </header>
      <div class="ai-board__body" data-ai-usable>${loading}</div>
    </article>

`
    : ''
  return `${useBoard}
    <article class="ai-board ai-board--news" id="${AI_NEWS_ID}" data-rail-section="${AI_NEWS_ID}" aria-labelledby="${AI_NEWS_ID}-title">
      <header class="ai-board__head">
        <div class="ai-board__heading">
          <p class="ai-board__kicker">${escapeHtml(copy.newsKicker)}</p>
          <div class="ai-board__title-row">
            <h2 class="ai-board__title" id="${AI_NEWS_ID}-title">${titleText(copy.newsTitle, AI_NEWS_ID)}</h2>
            <p class="ai-board__updated" data-ai-updated hidden></p>
          </div>
          ${note}
        </div>
        ${more(AI_NEWS_ID)}
      </header>
      <div class="ai-board__body" data-ai-news>${loading}</div>
    </article>`
}

/**
 * Render both boards into `host` and fill them from /ai-daily/latest.json.
 * Returns the issue so callers (the /ai/ page) can show the intro elsewhere.
 */
export async function mountAiBoards(
  host: HTMLElement,
  variant: AiBoardsVariant,
): Promise<AiDailyIssue | null> {
  host.classList.add('ai-boards', `ai-boards--${variant}`)
  host.classList.toggle('ai-boards--split', isStrictDirectLocale())
  host.setAttribute('aria-label', aiCopy().boardsAria)
  host.innerHTML = renderAiBoards(variant)

  const usable = host.querySelector<HTMLElement>('[data-ai-usable]')
  const news = host.querySelector<HTMLElement>('[data-ai-news]')
  const updated = host.querySelector<HTMLElement>('[data-ai-updated]')
  const count = host.querySelector<HTMLElement>('[data-ai-usable-count]')

  try {
    const issue = await loadLatestAiDaily()
    // Skills only matter for the zh-CN top-up; a failure there must not break the board.
    const skills = isStrictDirectLocale()
      ? await loadLatestAiSkills().then((s) => s.items).catch(() => null)
      : null
    const limit = variant === 'home' ? AI_HOME_LIMIT : Infinity
    if (usable) usable.innerHTML = renderUsableBody(issue, skills, limit)
    if (news) news.innerHTML = renderNewsBody(issue, false, limit)
    if (updated) {
      updated.textContent = formatUpdatedLine(issue.updatedAt)
      updated.hidden = false
    }
    host.querySelectorAll<HTMLElement>('[data-ai-content-note]').forEach((el) => {
      el.hidden = issue.translated === true
    })
    const n = usableCount(issue, skills)
    if (count && n > 0) {
      count.textContent = String(n)
      count.hidden = false
    }
    return issue
  } catch (err) {
    console.warn('[ai-daily]', err)
    const failed = `<p class="ai-empty">${escapeHtml(aiCopy().loadFailed)}</p>`
    if (usable) usable.innerHTML = failed
    if (news) news.innerHTML = failed
    return null
  }
}

/**
 * Two rail buttons that jump to the boards (homepage + /ai/).
 * `extra` (e.g. the「AI 最新 Skill」button) is placed before the divider.
 */
export function renderAiRailItems(extra = ''): string {
  const copy = aiCopy()
  const btn = (id: string, label: string, extra: string) => `<button
        type="button"
        class="app-rail__item app-rail__item--ai ${extra}"
        data-rail-id="${id}"
        title="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}"
      ><span>${escapeHtml(label)}</span></button>`
  const useBtn = isStrictDirectLocale() ? btn(AI_USABLE_ID, copy.railUsable, 'app-rail__item--ai-use') : ''
  return `${useBtn}${btn(AI_NEWS_ID, copy.railNews, 'app-rail__item--ai-news')}${extra}${renderArenaRailItem()}<span class="app-rail__divider" aria-hidden="true"></span>`
}

/**
 * Highlight the rail button of whichever board crosses the middle of the
 * viewport. Boards are tall, so a ratio threshold would never fire.
 */
export function observeAiBoards(onActive: (id: string) => void): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  const boards = document.querySelectorAll<HTMLElement>('[data-rail-section]')
  if (!boards.length) return null
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.railSection
        if (entry.isIntersecting && id) onActive(id)
      }
    },
    { root: null, threshold: 0, rootMargin: '-45% 0px -50% 0px' },
  )
  boards.forEach((board) => observer.observe(board))
  return observer
}

export function scrollToAiBoard(id: string): boolean {
  const el = document.getElementById(id)
  if (!el || !el.matches('[data-rail-section]')) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}

/**
 * Non-zh-CN homepage: there is no usable board, so「AI 大事」and「AI 最新 Skill」
 * share the first row. Wraps both hosts in one grid; zh-CN is left untouched.
 */
export function pairNewsWithSkills(boards: HTMLElement | null, skills: HTMLElement | null): boolean {
  if (isStrictDirectLocale() || !boards || !skills || !boards.parentElement) return false
  const wrap = document.createElement('div')
  wrap.className = 'ai-top ai-top--pair'
  boards.parentElement.insertBefore(wrap, boards)
  wrap.append(boards, skills)
  return true
}
