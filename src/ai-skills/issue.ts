import { fetchLocalizedJson } from '../ai-daily/localized'
import {
  AI_SKILL_ACCESS,
  AI_SKILL_SOURCE_TYPES,
  AI_SKILLS_LATEST_PATH,
  type AiSkillAccess,
  type AiSkillItem,
  type AiSkillSourceType,
  type AiSkillsIssue,
} from './types'

const ACCESS_SET = new Set<string>(AI_SKILL_ACCESS)
const SOURCE_SET = new Set<string>(AI_SKILL_SOURCE_TYPES)

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readItem(value: unknown): AiSkillItem | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const platform = str(raw.platform)
  const name = str(raw.name)
  const sourceUrl = str(raw.sourceUrl)
  if (!platform || !name || !sourceUrl) return null
  if (typeof raw.access !== 'string' || !ACCESS_SET.has(raw.access)) return null

  const sourceType = (
    typeof raw.sourceType === 'string' && SOURCE_SET.has(raw.sourceType) ? raw.sourceType : 'other'
  ) as AiSkillSourceType

  const item: AiSkillItem = {
    platform,
    name,
    summary: str(raw.summary),
    sourceType,
    sourceUrl,
    sourceName: str(raw.sourceName),
    publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(str(raw.publishedAt)) ? str(raw.publishedAt) : '',
    howTo: str(raw.howTo),
    access: raw.access as AiSkillAccess,
  }
  const accessNote = str(raw.accessNote)
  if (accessNote) item.accessNote = accessNote
  const relatedUrl = str(raw.relatedUrl)
  if (relatedUrl) {
    item.relatedUrl = relatedUrl
    const relatedName = str(raw.relatedName)
    if (relatedName) item.relatedName = relatedName
  }
  return item
}

/** Accepts the public JSON shape and drops entries that don't match the type. */
export function parseAiSkillsIssue(value: unknown): AiSkillsIssue {
  if (!value || typeof value !== 'object') throw new Error('AI skills JSON is not an object')
  const raw = value as Record<string, unknown>
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new Error('AI skills JSON is missing date')
  }
  if (!str(raw.updatedAt)) throw new Error('AI skills JSON is missing updatedAt')
  if (!Array.isArray(raw.items)) throw new Error('AI skills JSON is missing items')

  const items: AiSkillItem[] = []
  for (const entry of raw.items) {
    const item = readItem(entry)
    if (item) items.push(item)
  }
  return { date: raw.date, updatedAt: str(raw.updatedAt), intro: str(raw.intro), items }
}

/** Fetch today's issue in the current site language (falls back to Chinese), bypassing caches. */
export async function loadLatestAiSkills(): Promise<AiSkillsIssue> {
  const { raw, translated } = await fetchLocalizedJson(AI_SKILLS_LATEST_PATH, parseAiSkillsIssue)
  return { ...parseAiSkillsIssue(raw), translated }
}
