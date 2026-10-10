import { getLocale, localizedHref } from '../i18n'
import { aiSkillsMessages, type AiSkillsMessages } from '../i18n/aiSkills'
import { aiCopy, formatBeijingTime } from '../ai-daily/render'
import { AI_DAILY_PAGE_PATH } from '../ai-daily/types'
import { loadLatestAiSkills } from './issue'
import { AI_SKILL_PLATFORMS, type AiSkillItem, type AiSkillsIssue } from './types'

export type AiSkillsVariant = 'home' | 'page'

/** Section id shared by the homepage and /ai/ (rail + anchors use it). */
export const AI_SKILLS_ID = 'ai-skills'

/** Homepage shows this many cards per platform; /ai/ shows all. */
export const AI_SKILLS_HOME_PER_PLATFORM = 2

export function skillsCopy(): AiSkillsMessages {
  return aiSkillsMessages[getLocale()] ?? aiSkillsMessages['zh-CN']
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

function platformSlug(platform: string): string {
  const known = (AI_SKILL_PLATFORMS as readonly string[]).indexOf(platform)
  if (platform === '通用') return 'general'
  if (known >= 0) return platform.toLowerCase()
  return 'other'
}

function platformLabel(platform: string): string {
  return skillsCopy().platforms[platform] ?? platform
}

/** Group items by platform, known platforms first in their fixed order. */
export function groupSkills(items: AiSkillItem[]): { platform: string; items: AiSkillItem[] }[] {
  const order: string[] = [...AI_SKILL_PLATFORMS]
  for (const item of items) if (!order.includes(item.platform)) order.push(item.platform)
  return order
    .map((platform) => ({ platform, items: items.filter((item) => item.platform === platform) }))
    .filter((group) => group.items.length > 0)
}

const EXTERNAL_MARK = `<svg class="ai-ext" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4.5 2.5h5v5M9.3 2.7 3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

function renderLink(url: string, name: string, label: string, cls: string): string {
  const href = safeHref(url)
  const labelHtml = `<span class="ai-source__label">${escapeHtml(label)}</span>`
  if (!href) return `<span class="ai-source ${cls}">${labelHtml}${escapeHtml(name)}</span>`
  return `<a class="ai-source ${cls}" href="${href}" target="_blank" rel="noopener noreferrer">${labelHtml}${escapeHtml(name)}${EXTERNAL_MARK}</a>`
}

function renderCard(item: AiSkillItem): string {
  const copy = skillsCopy()
  const daily = aiCopy()
  const href = safeHref(item.sourceUrl)
  const name = escapeHtml(item.name)
  const title = href
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a>`
    : name
  const date = item.publishedAt
    ? `<time class="ai-skill-card__date" datetime="${escapeHtml(item.publishedAt)}">${escapeHtml(item.publishedAt)}</time>`
    : ''
  const how = item.howTo
    ? `<div class="ai-skill-card__how"><p class="ai-skill-card__how-text"><span class="ai-skill-card__how-label">${escapeHtml(copy.howTo)}</span>${escapeHtml(item.howTo)}</p></div>`
    : ''
  const note = item.accessNote
    ? `<p class="ai-skill-card__note">${escapeHtml(item.accessNote)}</p>`
    : ''
  const related = item.relatedUrl
    ? renderLink(item.relatedUrl, item.relatedName || copy.related, copy.related, 'ai-skill-card__related')
    : ''
  return `
    <li class="ai-skill-card">
      <div class="ai-skill-card__top">
        <span class="ai-skill-src ai-skill-src--${item.sourceType}">${escapeHtml(copy.sourceTypes[item.sourceType])}</span>
        ${date}
      </div>
      <h4 class="ai-skill-card__title">${title}</h4>
      ${item.summary ? `<p class="ai-skill-card__summary">${escapeHtml(item.summary)}</p>` : ''}
      ${how}
      <div class="ai-skill-card__foot">
        <div class="ai-skill-card__access"><span class="ai-access ai-access--${item.access}">${escapeHtml(daily.access[item.access])}</span>${note}</div>
        <div class="ai-skill-card__links">
          ${renderLink(item.sourceUrl, item.sourceName || copy.source, copy.source, '')}
          ${related}
        </div>
      </div>
    </li>`
}

export function renderSkillsBody(
  issue: AiSkillsIssue,
  variant: AiSkillsVariant,
  limit = Infinity,
): string {
  const copy = skillsCopy()
  let left = limit
  const groups = groupSkills(issue.items)
  if (groups.length === 0) return `<p class="ai-empty">${escapeHtml(copy.empty)}</p>`

  const page = localizedHref(AI_DAILY_PAGE_PATH)
  const intro =
    variant === 'home' && limit === Infinity && issue.intro ? `<p class="ai-intro">${escapeHtml(issue.intro)}</p>` : ''
  const sections = groups
    .map((group) => {
      let shown =
        variant === 'home' ? group.items.slice(0, AI_SKILLS_HOME_PER_PLATFORM) : group.items
      // Paired homepage column: a flat cap across all platforms.
      shown = shown.slice(0, Math.max(0, left))
      left -= shown.length
      if (shown.length === 0) return ''
      const hidden = group.items.length - shown.length
      const more =
        hidden > 0
          ? `<a class="ai-skill-group__more" href="${page}#${AI_SKILLS_ID}">${escapeHtml(fill(copy.morePlatform, { n: hidden }))}</a>`
          : ''
      return `
      <section class="ai-skill-group ai-skill-group--${platformSlug(group.platform)}">
        <h3 class="ai-group__title ai-skill-group__title">${escapeHtml(platformLabel(group.platform))}<span class="ai-group__count">${group.items.length}</span></h3>
        <ol class="ai-skill-grid">${shown.map(renderCard).join('')}</ol>
        ${more}
      </section>`
    })
    .join('')
  return `${intro}<div class="ai-skill-groups">${sections}</div>`
}

/** Static frame of the board; the body is filled once the JSON arrives. */
export function renderSkillsBoard(variant: AiSkillsVariant): string {
  const copy = skillsCopy()
  const page = localizedHref(AI_DAILY_PAGE_PATH)
  const more =
    variant === 'home'
      ? `<a class="ai-board__more" href="${page}#${AI_SKILLS_ID}">${escapeHtml(copy.viewAll)}</a>`
      : ''
  const title =
    variant === 'home'
      ? `<a href="${page}#${AI_SKILLS_ID}">${escapeHtml(copy.title)}</a>`
      : escapeHtml(copy.title)
  const note = copy.contentNote ? `<p class="ai-board__note" data-ai-content-note hidden>${escapeHtml(copy.contentNote)}</p>` : ''
  return `
    <article class="ai-board ai-board--skills" id="${AI_SKILLS_ID}" data-rail-section="${AI_SKILLS_ID}" aria-labelledby="${AI_SKILLS_ID}-title">
      <header class="ai-board__head">
        <div class="ai-board__heading">
          <p class="ai-board__kicker">${escapeHtml(copy.kicker)}</p>
          <div class="ai-board__title-row">
            <h2 class="ai-board__title" id="${AI_SKILLS_ID}-title">${title}<span class="ai-board__count" data-ai-skills-count hidden></span></h2>
            <p class="ai-board__updated" data-ai-skills-updated hidden></p>
          </div>
          <p class="ai-board__lead">${escapeHtml(copy.lead)}</p>
          ${note}
        </div>
        ${more}
      </header>
      <div class="ai-board__body" data-ai-skills>${`<p class="ai-empty">${escapeHtml(copy.loading)}</p>`}</div>
    </article>`
}

/**
 * Render the board into `host` synchronously (so rail observers can see it),
 * then fill it from /ai-skills/latest.json.
 */
export async function mountAiSkills(
  host: HTMLElement,
  variant: AiSkillsVariant,
  limit = Infinity,
): Promise<AiSkillsIssue | null> {
  host.classList.add('ai-boards', `ai-boards--${variant}`, 'ai-skills-host')
  host.innerHTML = renderSkillsBoard(variant)

  const body = host.querySelector<HTMLElement>('[data-ai-skills]')
  const updated = host.querySelector<HTMLElement>('[data-ai-skills-updated]')
  const count = host.querySelector<HTMLElement>('[data-ai-skills-count]')

  try {
    const issue = await loadLatestAiSkills()
    if (body) body.innerHTML = renderSkillsBody(issue, variant, limit)
    host.querySelectorAll<HTMLElement>('[data-ai-content-note]').forEach((el) => {
      el.hidden = issue.translated === true
    })
    if (updated) {
      updated.textContent = fill(skillsCopy().updated, {
        time: formatBeijingTime(issue.updatedAt) ?? '—',
      })
      updated.hidden = false
    }
    if (count && issue.items.length > 0) {
      count.textContent = String(issue.items.length)
      count.hidden = false
    }
    return issue
  } catch (err) {
    console.warn('[ai-skills]', err)
    if (body) body.innerHTML = `<p class="ai-empty">${escapeHtml(skillsCopy().loadFailed)}</p>`
    return null
  }
}

/** Rail button that jumps to the board (homepage + /ai/). */
export function renderSkillsRailItem(): string {
  const label = skillsCopy().rail
  return `<button
        type="button"
        class="app-rail__item app-rail__item--ai app-rail__item--ai-skills"
        data-rail-id="${AI_SKILLS_ID}"
        title="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}"
      ><span>${escapeHtml(label)}</span></button>`
}
