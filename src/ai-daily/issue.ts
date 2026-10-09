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
  if (!value || typeof value !== 'object') {
    throw new Error('AI daily JSON is not an object')
  }
  const raw = value as Record<string, unknown>
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new Error('AI daily JSON is missing date')
  }
  if (typeof raw.updatedAt !== 'string' || raw.updatedAt.trim() === '') {
    throw new Error('AI daily JSON is missing updatedAt')
  }
  if (typeof raw.intro !== 'string') {
    throw new Error('AI daily JSON is missing intro')
  }
  if (!Array.isArray(raw.items)) {
    throw new Error('AI daily JSON is missing items')
  }

  const items: AiDailyItem[] = []
  for (const entry of raw.items) {
    const item = readItem(entry)
    if (item) items.push(item)
  }

  return {
    date: raw.date,
    updatedAt: raw.updatedAt.trim(),
    intro: raw.intro.trim(),
    items,
  }
}

/** Beijing wall time, taken from the timestamp in the JSON. */
export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '更新于 —'
  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return `更新于 ${formatted}（北京时间）`
}

export async function loadLatestAiDaily(): Promise<AiDailyIssue> {
  const url = `${AI_DAILY_LATEST_PATH}?t=${Date.now()}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`AI daily JSON failed: ${response.status}`)
  }
  return parseAiDailyIssue(await response.json())
}
