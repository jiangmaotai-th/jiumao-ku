import { fetchLocalizedJson } from './localized'
import {
  AI_DAILY_ACCESS,
  AI_DAILY_CATEGORIES,
  AI_DAILY_LATEST_PATH,
  type AiDailyAccess,
  type AiDailyCategory,
  type AiDailyIssue,
  type AiDailyItem,
} from './types'

const CATEGORY_SET = new Set<string>(AI_DAILY_CATEGORIES)
const ACCESS_SET = new Set<string>(AI_DAILY_ACCESS)

function isCategory(value: unknown): value is AiDailyCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value)
}

function isAccess(value: unknown): value is AiDailyAccess {
  return typeof value === 'string' && ACCESS_SET.has(value)
}

function readItem(value: unknown): AiDailyItem | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!isCategory(raw.category)) return null
  if (typeof raw.title !== 'string' || raw.title.trim() === '') return null
  if (typeof raw.summary !== 'string') return null
  if (typeof raw.sourceUrl !== 'string' || typeof raw.sourceName !== 'string') return null
  if (!isAccess(raw.access)) return null

  const item: AiDailyItem = {
    category: raw.category,
    title: raw.title.trim(),
    summary: raw.summary.trim(),
    sourceUrl: raw.sourceUrl.trim(),
    sourceName: raw.sourceName.trim(),
    access: raw.access,
    usable: raw.usable === true,
  }
  if (typeof raw.accessNote === 'string' && raw.accessNote.trim() !== '') {
    item.accessNote = raw.accessNote.trim()
  }
  return item
}

/** Accepts the public JSON shape and drops entries that don't match the type. */
export function parseAiDailyIssue(value: unknown): AiDailyIssue {
  if (!value || typeof value !== 'object') throw new Error('AI daily JSON is not an object')
  const raw = value as Record<string, unknown>
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new Error('AI daily JSON is missing date')
  }
  if (typeof raw.updatedAt !== 'string' || raw.updatedAt.trim() === '') {
    throw new Error('AI daily JSON is missing updatedAt')
  }
  if (!Array.isArray(raw.items)) throw new Error('AI daily JSON is missing items')

  const items: AiDailyItem[] = []
  for (const entry of raw.items) {
    const item = readItem(entry)
    if (item) items.push(item)
  }
  return {
    date: raw.date,
    updatedAt: raw.updatedAt.trim(),
    intro: typeof raw.intro === 'string' ? raw.intro.trim() : '',
    items,
  }
}

/** Fetch today's issue in the current site language (falls back to Chinese), bypassing caches. */
export async function loadLatestAiDaily(): Promise<AiDailyIssue> {
  const { raw, translated } = await fetchLocalizedJson(AI_DAILY_LATEST_PATH, parseAiDailyIssue)
  return { ...parseAiDailyIssue(raw), translated }
}
