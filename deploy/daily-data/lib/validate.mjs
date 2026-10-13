/**
 * Checks on LLM text. A failed check means that item is published from the
 * source title and the short original description instead.
 */

const REFUSAL =
  /i(?:'| a)?m sorry|i cannot|i can't|i can’t|as an ai|i won(?:'|’)t|unable to (?:comply|assist|provide)|content policy|against (?:my|the) (?:policy|guidelines)|cannot fulfill|i must refuse|无法(?:提供|完成|回答|协助|生成)|我不能|作为(?:一个)?(?:人工智能|AI|语言模型)|抱歉[，,]|对不起[，,]我|不适合回答|无法满足/i

const TITLE_POLICY =
  /监管|法规|立法|法案|条例|制裁|出口管制|白宫|国务院|选举|台海|人权|地缘政治|总统|竞选|政治|\bregulations?\b|\bregulators?\b|\blegislation\b|\bsanctions?\b|\bgeopolitic\w*|\bwhite house\b|\bcongress\b|\bparliament\b|\bexecutive order\b|\bexport controls?\b|\bofac\b|\bentity list\b|\btrump\b|\bbiden\b|\belection\b/i

const SNIPPET_POLICY = /制裁|出口管制|白宫|国务院|台海|\bwhite house\b|\bexport controls?\b|\bofac\b|\bentity list\b|\bsanctions?\b/i

const STOP = new Set([
  'the', 'this', 'that', 'with', 'from', 'for', 'and', 'after', 'today', 'new', 'says',
  'into', 'over', 'its', 'how', 'why', 'what', 'when', 'your', 'their', 'will', 'has',
  'have', 'are', 'was', 'but', 'not', 'you', 'all', 'can', 'may', 'about', 'just',
  'more', 'than', 'who', 'announces', 'announce', 'launches', 'launch', 'releases',
  'release', 'introduces', 'introduce', 'using', 'update', 'updates',
])

const BRANDS = [
  'openai', 'anthropic', 'claude', 'google', 'gemini', 'deepseek', 'qwen', 'alibaba',
  'meta', 'llama', 'mistral', 'microsoft', 'copilot', 'nvidia', 'xai', 'grok',
  'bytedance', 'zhipu', 'glm', 'kimi', 'moonshot', 'baidu', 'ernie', 'tencent',
  'hunyuan', 'cursor', 'github', 'huggingface', 'arxiv', 'apple', 'amazon', 'cohere',
  'perplexity', 'midjourney', 'flux', 'deepmind',
]

export function chars(value) {
  return [...String(value ?? '')].length
}

export function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
}

export function isRefusal(value) {
  const text = cleanText(value)
  if (!text) return false
  return REFUSAL.test(text)
}

/** Regulation / politically sensitive source: publish title + link only. */
export function isPolicySource(title, snippet = '') {
  if (TITLE_POLICY.test(cleanText(title))) return true
  return SNIPPET_POLICY.test(cleanText(snippet))
}

export function extractEntities(title) {
  const text = cleanText(title)
  const out = []
  const seen = new Set()
  const add = (token) => {
    const key = token.toLowerCase()
    if (key.length < 2 || STOP.has(key) || seen.has(key)) return
    seen.add(key)
    out.push(token)
  }
  for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9.+#_-]*\d[A-Za-z0-9.+#_-]*\b/g)) add(match[0])
  for (const match of text.matchAll(/\b[A-Z][A-Za-z]{2,}\b/g)) add(match[0])
  const lower = text.toLowerCase()
  for (const brand of BRANDS) {
    if (lower.includes(brand)) add(brand)
  }
  for (const match of text.matchAll(/\b\d{2,}(?:\.\d+)?%?\b/g)) add(match[0])
  return out.slice(0, 8)
}

function entityVerdict(sourceTitle, haystack) {
  const entities = extractEntities(sourceTitle)
  if (!entities.length) return null
  const lower = cleanText(haystack).toLowerCase()
  const missing = entities.filter((entity) => !lower.includes(entity.toLowerCase()))
  const need = Math.ceil(entities.length * 0.6)
  const found = entities.length - missing.length
  if (found >= need) return null
  return `missing-entities:${missing.slice(0, 5).join(',')}`
}

/**
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateRewrite({ sourceTitle, sourceSnippet, title, summary }) {
  const nextTitle = cleanText(title)
  const nextSummary = cleanText(summary)
  if (!nextTitle) return { ok: false, reason: 'title-empty' }
  if (!nextSummary) return { ok: false, reason: 'summary-empty' }
  if (isRefusal(nextTitle) || isRefusal(nextSummary)) return { ok: false, reason: 'llm-refusal' }
  const titleLen = chars(nextTitle)
  const summaryLen = chars(nextSummary)
  const sourceLen = chars(cleanText(sourceTitle))
  const snippetLen = chars(cleanText(sourceSnippet))
  if (titleLen < 4) return { ok: false, reason: 'title-too-short' }
  if (titleLen > 100) return { ok: false, reason: 'title-too-long' }
  if (sourceLen > 40 && titleLen > sourceLen * 3.5) return { ok: false, reason: 'title-too-long' }
  const summaryMin = snippetLen >= 80 ? 36 : 20
  const summaryMax = Math.min(480, Math.max(240, Math.round(Math.max(snippetLen, 80) * 3)))
  if (summaryLen < summaryMin) return { ok: false, reason: 'summary-too-short' }
  if (summaryLen > summaryMax) return { ok: false, reason: 'summary-too-long' }
  const entities = entityVerdict(sourceTitle, `${nextTitle}\n${nextSummary}`)
  if (entities) return { ok: false, reason: entities }
  return { ok: true }
}

/**
 * Title translation. Missing source names are allowed: a month, a common word,
 * or a repo slug often will not survive translation. Refusal, empty text, and
 * a wild length still fall back to the original title.
 */
export function validateTranslatedTitle({ sourceTitle, translated }) {
  const next = cleanText(translated)
  if (!next) return { ok: false, reason: 'title-empty' }
  if (isRefusal(next)) return { ok: false, reason: 'llm-refusal' }
  const titleLen = chars(next)
  const sourceLen = chars(cleanText(sourceTitle))
  if (titleLen < 4) return { ok: false, reason: 'title-too-short' }
  if (titleLen > 110) return { ok: false, reason: 'title-too-long' }
  if (sourceLen > 36 && titleLen > sourceLen * 3.5) return { ok: false, reason: 'title-too-long' }
  return { ok: true }
}

/** Translated summary. Same safety checks as the title, without an entity list. */
export function validateTranslatedBody({ sourceTitle, sourceSummary, translated }) {
  const next = cleanText(translated)
  if (!next) return { ok: false, reason: 'summary-empty' }
  if (isRefusal(next)) return { ok: false, reason: 'llm-refusal' }
  const summaryLen = chars(next)
  const base = chars(cleanText(sourceSummary)) || chars(cleanText(sourceTitle))
  const summaryMin = base >= 80 ? 24 : 12
  const summaryMax = Math.min(520, Math.max(260, Math.round(Math.max(base, 60) * 3.2)))
  if (summaryLen < summaryMin) return { ok: false, reason: 'summary-too-short' }
  if (summaryLen > summaryMax) return { ok: false, reason: 'summary-too-long' }
  return { ok: true }
}

export function validateIntro(text) {
  const next = cleanText(text)
  if (!next) return { ok: false, reason: 'intro-empty' }
  if (isRefusal(next)) return { ok: false, reason: 'llm-refusal' }
  if (isPolicySource(next, '')) return { ok: false, reason: 'intro-policy' }
  const length = chars(next)
  if (length < 16) return { ok: false, reason: 'intro-too-short' }
  if (length > 360) return { ok: false, reason: 'intro-too-long' }
  return { ok: true }
}

/** Optional one-liner. A bad note is dropped; it does not fail the item. */
export function noteOrEmpty(text) {
  const next = cleanText(text)
  if (!next || isRefusal(next) || isPolicySource(next, '') || chars(next) > 180 || chars(next) < 4) return ''
  return next
}

export function shortDescription(title, snippet) {
  const head = cleanText(title)
  const body = cleanText(snippet)
  if (!body || body === head || chars(body) < chars(head) + 12) return ''
  if (chars(body) <= 220) return body
  const cut = [...body].slice(0, 220).join('')
  const space = cut.lastIndexOf(' ')
  const clipped = (space > 140 ? cut.slice(0, space) : cut).trim()
  return `${clipped}…`
}

export function clipTitle(title) {
  const text = cleanText(title)
  if (chars(text) <= 180) return text
  return `${[...text].slice(0, 179).join('').trim()}…`
}

export function mostlyHan(text) {
  const han = (String(text).match(/\p{Script=Han}/gu) || []).length
  return han >= 4 && han * 2 >= chars(text)
}
