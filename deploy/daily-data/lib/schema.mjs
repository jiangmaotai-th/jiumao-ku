/** Mirrors the frontend parsers in src/ai-daily/issue.ts and src/ai-skills/issue.ts. */

export const DAILY_CATEGORIES = ['模型与产品', '论文与研究', '开源与工具', '行业动态', '政策与监管', 'X 热议']
export const ACCESS = ['direct', 'restricted', 'unavailable', 'na']
export const SKILL_SOURCE_TYPES = ['official', 'x', 'github', 'reddit', 'hn', 'other']

const CATEGORY_SET = new Set(DAILY_CATEGORIES)
const ACCESS_SET = new Set(ACCESS)
const SOURCE_SET = new Set(SKILL_SOURCE_TYPES)

function str(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function assertDailyIssue(value) {
  if (!value || typeof value !== 'object') throw new Error('AI daily JSON is not an object')
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    throw new Error('AI daily JSON is missing date')
  }
  if (!str(value.updatedAt)) throw new Error('AI daily JSON is missing updatedAt')
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error('AI daily JSON is missing items')
  }
  for (const item of value.items) {
    if (!CATEGORY_SET.has(item?.category)) throw new Error('AI daily item has a bad category')
    if (!str(item.title)) throw new Error('AI daily item is missing title')
    if (typeof item.summary !== 'string') throw new Error('AI daily item is missing summary')
    if (typeof item.sourceUrl !== 'string' || !/^https?:\/\//i.test(item.sourceUrl)) {
      throw new Error('AI daily item is missing sourceUrl')
    }
    if (typeof item.sourceName !== 'string') throw new Error('AI daily item is missing sourceName')
    if (!ACCESS_SET.has(item.access)) throw new Error('AI daily item has a bad access')
    if (typeof item.usable !== 'boolean') throw new Error('AI daily item is missing usable')
    if (item.category === '政策与监管' && str(item.summary)) {
      throw new Error('policy item must not carry a rewritten summary')
    }
  }
  return value
}

export function assertSkillsIssue(value) {
  if (!value || typeof value !== 'object') throw new Error('AI skills JSON is not an object')
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    throw new Error('AI skills JSON is missing date')
  }
  if (!str(value.updatedAt)) throw new Error('AI skills JSON is missing updatedAt')
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error('AI skills JSON is missing items')
  }
  for (const item of value.items) {
    if (!str(item?.platform) || !str(item.name)) throw new Error('AI skills item is missing name')
    if (typeof item.summary !== 'string') throw new Error('AI skills item is missing summary')
    if (!SOURCE_SET.has(item.sourceType)) throw new Error('AI skills item has a bad sourceType')
    if (typeof item.sourceUrl !== 'string' || !/^https?:\/\//i.test(item.sourceUrl)) {
      throw new Error('AI skills item is missing sourceUrl')
    }
    if (typeof item.sourceName !== 'string') throw new Error('AI skills item is missing sourceName')
    if (str(item.publishedAt) && !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)) {
      throw new Error('AI skills item has a bad publishedAt')
    }
    if (typeof item.howTo !== 'string') throw new Error('AI skills item is missing howTo')
    if (!ACCESS_SET.has(item.access)) throw new Error('AI skills item has a bad access')
  }
  return value
}

export function assertSameShape(zh, locale) {
  if (locale.date !== zh.date || locale.updatedAt !== zh.updatedAt) {
    throw new Error('locale issue date does not match')
  }
  if (!Array.isArray(locale.items) || locale.items.length !== zh.items.length) {
    throw new Error('locale issue item count does not match')
  }
  for (let i = 0; i < zh.items.length; i++) {
    if (locale.items[i].sourceUrl !== zh.items[i].sourceUrl) {
      throw new Error('locale issue sourceUrl does not match')
    }
    if (locale.items[i].category && locale.items[i].category !== zh.items[i].category) {
      throw new Error('locale issue category does not match')
    }
    if (locale.items[i].access !== zh.items[i].access) {
      throw new Error('locale issue access does not match')
    }
  }
}
