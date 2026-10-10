/**
 * 「AI 最新 Skill」— one day's list of new skills / plugins / extensions for
 * popular AI tools, read from /ai-skills/latest.json (archive: YYYY-MM-DD.json).
 */

/** Display order of platform groups. Unknown platforms are appended after these. */
export const AI_SKILL_PLATFORMS = [
  'Claude',
  'ChatGPT',
  'Gemini',
  'Cursor',
  'Copilot',
  'Perplexity',
  'Manus',
  '通用',
] as const

export type AiSkillKnownPlatform = (typeof AI_SKILL_PLATFORMS)[number]

/** Where the item was found. */
export const AI_SKILL_SOURCE_TYPES = [
  'official',
  'x',
  'github',
  'reddit',
  'hn',
  'other',
] as const

export type AiSkillSourceType = (typeof AI_SKILL_SOURCE_TYPES)[number]

/** Same scale as the AI daily: can a mainland-China reader use it directly? */
export const AI_SKILL_ACCESS = ['direct', 'restricted', 'unavailable', 'na'] as const

export type AiSkillAccess = (typeof AI_SKILL_ACCESS)[number]

export interface AiSkillItem {
  /** One of AI_SKILL_PLATFORMS, or any other non-empty label. */
  platform: string
  name: string
  /** One sentence (Chinese): what it does. */
  summary: string
  sourceType: AiSkillSourceType
  sourceUrl: string
  sourceName: string
  /** YYYY-MM-DD, the date we could verify. */
  publishedAt: string
  /** One sentence: how to install or use it. */
  howTo: string
  access: AiSkillAccess
  accessNote?: string
  /** Optional second link, e.g. the GitHub repo behind an X post. */
  relatedUrl?: string
  relatedName?: string
}

export interface AiSkillsIssue {
  /** Set by the loader: true when the text is in the page language. */
  translated?: boolean
  /** YYYY-MM-DD */
  date: string
  /** ISO 8601 with an explicit offset, expected `+08:00`. */
  updatedAt: string
  intro: string
  items: AiSkillItem[]
}

export const AI_SKILLS_LATEST_PATH = '/ai-skills/latest.json'
