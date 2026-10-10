/** Categories shown under「AI 大事」, in display order. Values are the JSON strings. */
export const AI_DAILY_CATEGORIES = [
  '模型与产品',
  '论文与研究',
  '开源与工具',
  '行业动态',
  '政策与监管',
  'X 热议',
] as const

export type AiDailyCategory = (typeof AI_DAILY_CATEGORIES)[number]

/** Whether a reader in mainland China can open the thing itself. */
export const AI_DAILY_ACCESS = ['direct', 'restricted', 'unavailable', 'na'] as const

export type AiDailyAccess = (typeof AI_DAILY_ACCESS)[number]

/**
 * One day's digest. Both homepage boards read this same object:
 * `usable: true` items also appear in「今天就能用」.
 */
export interface AiDailyItem {
  category: AiDailyCategory
  title: string
  summary: string
  sourceUrl: string
  sourceName: string
  access: AiDailyAccess
  /** Shown beside the access label. Omitted when empty. */
  accessNote?: string
  /** True when a reader can open, download, sign up, or read it today. */
  usable: boolean
}

export interface AiDailyIssue {
  /** Set by the loader: true when the text is in the page language. */
  translated?: boolean
  /** YYYY-MM-DD */
  date: string
  /** ISO 8601 with an explicit offset, expected `+08:00`. */
  updatedAt: string
  intro: string
  items: AiDailyItem[]
}

export const AI_DAILY_LATEST_PATH = '/ai-daily/latest.json'
export const AI_DAILY_PAGE_PATH = '/ai/'
