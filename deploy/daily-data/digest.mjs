import { writeJsonAtomic } from './lib/atomic.mjs'
import { collectNews, collectSkills, platformGuess, sourceTypeFor } from './lib/collect.mjs'
import { ACCESS, DAILY_CATEGORIES, SKILL_SOURCE_TYPES, assertDailyIssue, assertSameShape, assertSkillsIssue } from './lib/schema.mjs'
import { shanghaiParts } from './lib/time.mjs'
import {
  cleanText,
  clipTitle,
  isPolicySource,
  mostlyHan,
  noteOrEmpty,
  shortDescription,
  validateIntro,
  validateRewrite,
  validateTranslatedBody,
  validateTranslatedTitle,
} from './lib/validate.mjs'

export const LOCALE_SLUGS = ['en', 'zh-tw', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'hi', 'th']

const LANG = {
  'zh-cn': 'Simplified Chinese',
  en: 'English',
  'zh-tw': 'Traditional Chinese (Taiwan)',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Brazilian Portuguese',
  ru: 'Russian',
  hi: 'Hindi',
  th: 'Thai',
}

const GROUPS = [
  ['en', 'zh-tw', 'ja'],
  ['ko', 'fr', 'de'],
  ['es', 'pt', 'ru'],
  ['hi', 'th'],
]

const INTRO = {
  daily: {
    'zh-cn': (n) => `今天整理了 ${n} 条公开来源里的 AI 动态，每条都附上原始链接。`,
    en: (n) => `Today's list has ${n} items from public sources, each with its original link.`,
    'zh-tw': (n) => `今天整理了 ${n} 則公開來源的 AI 動態，每則都附上原始連結。`,
    ja: (n) => `公開ソースから ${n} 件をまとめました。各項目に元のリンクを付けています。`,
    ko: (n) => `공개 출처 ${n}건을 모았습니다. 각 항목에 원문 링크가 있습니다.`,
    fr: (n) => `La liste du jour compte ${n} éléments de sources publiques, chacun avec son lien d'origine.`,
    de: (n) => `Die Liste enthält ${n} Einträge aus öffentlichen Quellen, jeweils mit Originallink.`,
    es: (n) => `La lista de hoy tiene ${n} elementos de fuentes públicas, cada uno con su enlace original.`,
    pt: (n) => `A lista de hoje tem ${n} itens de fontes públicas, cada um com o link original.`,
    ru: (n) => `В сегодняшнем списке ${n} материалов из открытых источников, у каждого есть исходная ссылка.`,
    hi: (n) => `आज की सूची में सार्वजनिक स्रोतों की ${n} मदें हैं, हर एक के साथ मूल लिंक है।`,
    th: (n) => `รายการวันนี้มี ${n} รายการจากแหล่งสาธารณะ พร้อมลิงก์ต้นทาง`,
  },
  skills: {
    'zh-cn': (n) => `今天整理了 ${n} 条公开来源里的 AI 技能、插件或扩展，每条都附上原始链接。`,
    en: (n) => `Today's skill list has ${n} items from public sources, each with its original link.`,
    'zh-tw': (n) => `今天整理了 ${n} 則公開來源的 AI 技能或外掛，每則都附上原始連結。`,
    ja: (n) => `公開ソースから AI スキル ${n} 件をまとめました。各項目に元のリンクがあります。`,
    ko: (n) => `공개 출처의 AI 스킬 ${n}건입니다. 각 항목에 원문 링크가 있습니다.`,
    fr: (n) => `La liste compte ${n} skills ou extensions de sources publiques, chacun avec son lien.`,
    de: (n) => `Die Liste enthält ${n} Skills oder Erweiterungen aus öffentlichen Quellen.`,
    es: (n) => `La lista tiene ${n} skills o extensiones de fuentes públicas, cada uno con su enlace.`,
    pt: (n) => `A lista tem ${n} skills ou extensões de fontes públicas, cada um com o link original.`,
    ru: (n) => `В списке ${n} навыков или расширений из открытых источников, у каждого есть ссылка.`,
    hi: (n) => `सूची में सार्वजनिक स्रोतों के ${n} स्किल हैं, हर एक के साथ मूल लिंक है।`,
    th: (n) => `รายการมีสกิลจากแหล่งสาธารณะ ${n} รายการ พร้อมลิงก์ต้นทาง`,
  },
}

const ACCESS_NOTE = {
  'zh-cn': {
    direct: '来源页面一般可以直接打开。',
    restricted: '使用本身通常需要海外账号或网络。',
  },
  en: {
    direct: 'The source page is generally openable directly.',
    restricted: 'Using the product usually needs an overseas account or network.',
  },
}

const DIRECT_HOST = [
  /^arxiv\.org$/,
  /(^|\.)github\.io$/,
  /^github\.com$/,
  /^modelscope\.cn$/,
  /(^|\.)deepseek\.com$/,
  /^moonshot\.cn$/,
  /^kimi\.com$/,
  /^bigmodel\.cn$/,
  /(^|\.)zhipuai\.cn$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)aliyun\.com$/,
  /(^|\.)alibabacloud\.com$/,
]
const RESTRICTED_HOST = [
  /(^|\.)openai\.com$/,
  /^x\.com$/,
  /^twitter\.com$/,
  /(^|\.)anthropic\.com$/,
  /^claude\.com$/,
  /^claude\.ai$/,
  /^gemini\.google\.com$/,
]

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function categoryFor(candidate) {
  if (candidate.policy || isPolicySource(candidate.title, candidate.snippet)) return '政策与监管'
  const blob = `${candidate.title} ${candidate.snippet}`
  if (/arxiv\.org/i.test(candidate.url)) return '论文与研究'
  if (/融资|估值|收购|\bseries\s+[a-e]\b|\bvaluation\b|\bacquired\b|\braises\b[^.]{0,40}(?:\$|million|billion|\d)/i.test(blob)) return '行业动态'
  if (/github\.com|huggingface\.co/i.test(candidate.url)) return '开源与工具'
  if (/(^|\.)x\.com$|^twitter\.com$/i.test(hostOf(candidate.url))) return 'X 热议'
  return '模型与产品'
}

function accessFor(candidate, category, locale = 'zh-cn') {
  if (category === '政策与监管') return { access: 'na', usable: false, note: '' }
  if (category === '行业动态') return { access: 'na', usable: false, note: '' }
  const host = hostOf(candidate.url)
  const notes = ACCESS_NOTE[locale] || ACCESS_NOTE.en
  if (DIRECT_HOST.some((re) => re.test(host))) return { access: 'direct', usable: true, note: notes.direct }
  if (RESTRICTED_HOST.some((re) => re.test(host))) return { access: 'restricted', usable: true, note: notes.restricted }
  return { access: 'restricted', usable: true, note: '' }
}

function logItem(log, { id, locale, reason, title, policy = false }) {
  const head = policy ? 'policy source-only' : 'fallback'
  log.info(`${head} id=${id} locale=${locale} reason=${reason} title=${JSON.stringify(String(title || '').slice(0, 80))}`)
}

function sourceDaily(candidate, locale = 'zh-cn') {
  const category = categoryFor(candidate)
  const access = accessFor(candidate, category, locale)
  const item = {
    category,
    title: clipTitle(candidate.title),
    summary: category === '政策与监管' ? '' : shortDescription(candidate.title, candidate.snippet),
    sourceUrl: candidate.url,
    sourceName: candidate.sourceName,
    access: access.access,
    usable: access.usable,
  }
  if (access.note) item.accessNote = access.note
  return item
}

function sourceSkill(candidate, locale = 'zh-cn') {
  const policy = candidate.policy || isPolicySource(candidate.title, candidate.snippet)
  const access = policy
    ? { access: 'na', usable: false, note: '' }
    : accessFor({ ...candidate, policy: false }, categoryFor({ ...candidate, policy: false }), locale)
  const item = {
    platform: candidate.platform || platformGuess(`${candidate.title} ${candidate.snippet}`),
    name: clipTitle(candidate.title),
    summary: policy ? '' : shortDescription(candidate.title, candidate.snippet),
    sourceType: SKILL_SOURCE_TYPES.includes(candidate.sourceType) ? candidate.sourceType : sourceTypeFor(candidate.url),
    sourceUrl: candidate.url,
    sourceName: candidate.sourceName,
    publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(candidate.publishedAt || '') ? candidate.publishedAt : '',
    howTo: '',
    access: access.access,
  }
  if (candidate.relatedUrl && /^https?:\/\//i.test(candidate.relatedUrl)) {
    item.relatedUrl = candidate.relatedUrl
    if (candidate.relatedName) item.relatedName = candidate.relatedName
  }
  if (access.note && !policy) item.accessNote = access.note
  return item
}

function indexRows(payload) {
  const rows = new Map()
  const items = Array.isArray(payload?.items) ? payload.items : []
  for (const row of items) {
    if (row && typeof row.id === 'string') rows.set(row.id, row)
  }
  return rows
}

const DAILY_SYSTEM = `你是九猫库的编辑。只根据用户给出的 JSON 素材写简体中文 JSON，不要编造素材里没有的名字、数字或链接。
每条 title 必须保留素材标题中的专有名词、型号和数字。title 约 12–40 个字。summary 为两到三句，约 40–180 个字。
category 只能是：${DAILY_CATEGORIES.join('、')}。
access 只能是 direct、restricted、unavailable、na。
direct 表示中国大陆读者不翻墙、不注册海外账号就能打开来源并阅读或下载。arXiv 与 GitHub 标 direct。OpenAI、Anthropic、Claude、Gemini、X 标 restricted。
融资与收购标「行业动态」，access 为 na，usable 为 false。
不要改写监管、立法、制裁或政治内容；这类素材不会出现在输入里。
intro 用两句概括已选条目，不要写政治或监管。
只输出 JSON：{"intro":"","items":[{"id":"","category":"","title":"","summary":"","access":"","accessNote":"","usable":true}]}
id 必须来自输入。accessNote 为一句使用说明，没有就用空字符串。`

const SKILL_SYSTEM = `你是九猫库的编辑。只根据用户给出的 JSON 素材写简体中文 JSON，不要编造安装命令、名字或数字。
platform 尽量用：Claude、ChatGPT、Gemini、Cursor、Copilot、Perplexity、Manus、通用。
name 保留素材里的专名。summary 为一句，说明它做什么。howTo 为一句怎么安装或使用；素材没写步骤就用空字符串，不要编造命令。
access 只能是 direct、restricted、unavailable、na。GitHub 仓库标 direct。需要海外账号的产品标 restricted。
不要改写监管、立法、制裁或政治内容。
intro 用两句说明今天收录了什么，不要写政治或监管。
只输出 JSON：{"intro":"","items":[{"id":"","platform":"","name":"","summary":"","howTo":"","access":"","accessNote":"","sourceName":""}]}`

function translateSystem(kind) {
  const fields = kind === 'skills'
    ? '非 policy 条目翻译 name、summary、howTo、accessNote、sourceName、relatedName。policy 条目只翻译 name，不要写 summary。'
    : '非 policy 条目翻译 title、summary、accessNote、sourceName。policy 条目只翻译 title，不要写 summary。'
  return `把用户 JSON 里的文案翻译成指定语言。不要新增事实，不要改专有名词、型号和数字。${fields}
intro 也要翻译；如果 intro 涉及监管或政治，改成一句中性的「今天收录了若干公开来源」。
只输出 JSON，键是语言代码：{"en":{"intro":"","items":[{"id":"","title":"","summary":"","accessNote":"","sourceName":""}]}}
skills 的条目用 name 而不是 title。条目数量和 id 必须与输入一致。`
}

async function completeOrNull(llm, log, request) {
  if (!llm.available) return { payload: null, reason: llm.unavailableReason || 'no-api-key' }
  try {
    const payload = await llm.completeJson(request)
    return { payload, reason: '' }
  } catch (error) {
    log.error(`llm unreachable purpose=${request.purpose}: ${error.message}`)
    return { payload: null, reason: 'llm-unreachable' }
  }
}

function applyDailyRow(candidate, row, locale, log) {
  if (!row || row.category === '政策与监管' || isPolicySource(row.title, row.summary) || isPolicySource(candidate.title, candidate.snippet)) {
    const reason = !row ? 'missing-from-llm' : 'policy'
    logItem(log, { id: candidate.id, locale, reason, title: candidate.title, policy: reason === 'policy' || isPolicySource(candidate.title, candidate.snippet) })
    return sourceDaily({ ...candidate, policy: reason === 'policy' || candidate.policy || isPolicySource(candidate.title, candidate.snippet) }, locale)
  }
  const verdict = validateRewrite({
    sourceTitle: candidate.title,
    sourceSnippet: candidate.snippet,
    title: row.title,
    summary: row.summary,
  })
  if (!verdict.ok) {
    logItem(log, { id: candidate.id, locale, reason: verdict.reason, title: candidate.title })
    return sourceDaily(candidate, locale)
  }
  const category = DAILY_CATEGORIES.includes(row.category) ? row.category : categoryFor(candidate)
  if (category === '政策与监管') {
    logItem(log, { id: candidate.id, locale, reason: 'policy', title: candidate.title, policy: true })
    return sourceDaily({ ...candidate, policy: true }, locale)
  }
  let access = ACCESS.includes(row.access) ? row.access : accessFor(candidate, category, locale).access
  const host = hostOf(candidate.url)
  if (category === '行业动态') access = 'na'
  if (access === 'direct' && RESTRICTED_HOST.some((re) => re.test(host))) access = 'restricted'
  if (access !== 'direct' && category !== '行业动态' && DIRECT_HOST.some((re) => re.test(host))) access = 'direct'
  const usable = access === 'na' ? false : access === 'direct' ? true : row.usable === true
  const item = {
    category,
    title: cleanText(row.title),
    summary: cleanText(row.summary),
    sourceUrl: candidate.url,
    sourceName: noteOrEmpty(row.sourceName) || candidate.sourceName,
    access,
    usable,
  }
  const note = noteOrEmpty(row.accessNote) || accessFor(candidate, category, locale).note
  if (note && access !== 'na') item.accessNote = note
  return item
}

function applySkillRow(candidate, row, locale, log) {
  const policy = candidate.policy || isPolicySource(candidate.title, candidate.snippet) || isPolicySource(row?.name, row?.summary)
  if (policy || !row) {
    logItem(log, {
      id: candidate.id,
      locale,
      reason: policy ? 'policy' : 'missing-from-llm',
      title: candidate.title,
      policy,
    })
    return sourceSkill({ ...candidate, policy }, locale)
  }
  const verdict = validateRewrite({
    sourceTitle: candidate.title,
    sourceSnippet: candidate.snippet,
    title: row.name,
    summary: row.summary,
  })
  if (!verdict.ok) {
    logItem(log, { id: candidate.id, locale, reason: verdict.reason, title: candidate.title })
    return sourceSkill(candidate, locale)
  }
  let access = ACCESS.includes(row.access) ? row.access : accessFor(candidate, '模型与产品', locale).access
  const host = hostOf(candidate.url)
  if (access === 'direct' && RESTRICTED_HOST.some((re) => re.test(host))) access = 'restricted'
  if (DIRECT_HOST.some((re) => re.test(host))) access = 'direct'
  const howTo = inventedHowTo(row.howTo, candidate) ? '' : noteOrEmpty(row.howTo)
  if (row.howTo && !howTo) logItem(log, { id: candidate.id, locale, reason: 'howto-rejected', title: candidate.title })
  const item = {
    platform: cleanText(row.platform) || candidate.platform || platformGuess(candidate.title),
    name: cleanText(row.name),
    summary: cleanText(row.summary),
    sourceType: sourceTypeFor(candidate.url) === 'other'
      ? (SKILL_SOURCE_TYPES.includes(candidate.sourceType) ? candidate.sourceType : 'other')
      : sourceTypeFor(candidate.url),
    sourceUrl: candidate.url,
    sourceName: noteOrEmpty(row.sourceName) || candidate.sourceName,
    publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(candidate.publishedAt || '') ? candidate.publishedAt : '',
    howTo,
    access,
  }
  if (candidate.relatedUrl) {
    item.relatedUrl = candidate.relatedUrl
    if (candidate.relatedName) item.relatedName = candidate.relatedName
  }
  const note = noteOrEmpty(row.accessNote) || (access === 'na' ? '' : accessFor(candidate, '模型与产品', locale).note)
  if (note) item.accessNote = note
  return item
}

function inventedHowTo(text, candidate) {
  const urls = String(text || '').match(/https?:\/\/[^\s)]+/g) || []
  return urls.some((url) => {
    const normalized = url.replace(/[.,)]+$/, '')
    return normalized !== candidate.url && normalized !== candidate.relatedUrl
  })
}

async function composeIssue({ kind, candidates, llm, log, now }) {
  const clock = shanghaiParts(now)
  const prepared = candidates.map((candidate) => ({
    ...candidate,
    policy: Boolean(candidate.policy) || isPolicySource(candidate.title, candidate.snippet),
  }))
  const writable = prepared.filter((candidate) => !candidate.policy)
  let rows = new Map()
  let intro = ''
  let modeReason = ''
  if (!writable.length) {
    modeReason = 'policy-only'
  } else if (!llm.available) {
    modeReason = llm.unavailableReason || 'no-api-key'
    log.info(`llm fallback mode purpose=${kind}: ${modeReason}; publishing source titles and descriptions`)
  } else {
    const request = {
      purpose: kind === 'skills' ? 'skills-compose' : 'daily-compose',
      system: kind === 'skills' ? SKILL_SYSTEM : DAILY_SYSTEM,
      user: JSON.stringify({
        items: writable.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          source: candidate.sourceName,
          date: candidate.publishedAt,
          snippet: cleanText(candidate.snippet).slice(0, 500),
          platform: candidate.platform || '',
        })),
      }),
      maxTokens: 4096,
    }
    const result = await completeOrNull(llm, log, request)
    if (!result.payload) {
      modeReason = result.reason
      log.info(`llm fallback mode purpose=${kind}: ${modeReason}; publishing source titles and descriptions`)
    } else {
      rows = indexRows(result.payload)
      const introCheck = validateIntro(result.payload.intro)
      intro = introCheck.ok ? cleanText(result.payload.intro) : ''
      if (!introCheck.ok) logItem(log, { id: `${kind}-intro`, locale: 'zh-cn', reason: introCheck.reason, title: '' })
    }
  }

  const items = prepared.map((candidate) => {
    if (candidate.policy) {
      logItem(log, { id: candidate.id, locale: 'zh-cn', reason: 'policy', title: candidate.title, policy: true })
      return kind === 'skills' ? sourceSkill(candidate, 'zh-cn') : sourceDaily(candidate, 'zh-cn')
    }
    if (modeReason) {
      logItem(log, { id: candidate.id, locale: 'zh-cn', reason: modeReason, title: candidate.title })
      return kind === 'skills' ? sourceSkill(candidate, 'zh-cn') : sourceDaily(candidate, 'zh-cn')
    }
    const row = rows.get(candidate.id)
    return kind === 'skills'
      ? applySkillRow(candidate, row, 'zh-cn', log)
      : applyDailyRow(candidate, row, 'zh-cn', log)
  })

  if (!intro) intro = INTRO[kind]['zh-cn'](items.length)
  const issue = { date: clock.date, updatedAt: clock.iso, intro, items }
  return { issue, prepared, modeReason }
}

async function translatePolicyTitles(items, prepared, llm, log, locale, kind) {
  const byId = new Map(prepared.map((candidate) => [candidate.id, candidate]))
  const todo = []
  items.forEach((item, index) => {
    const source = byId.get(prepared[index]?.id) || [...byId.values()].find((candidate) => candidate.url === item.sourceUrl)
    const policy = source?.policy || item.category === '政策与监管' || (kind === 'skills' && item.summary === '' && item.access === 'na' && source?.policy)
    if (!policy || !source) return
    if (locale === 'zh-cn' && mostlyHan(source.title)) return
    todo.push({ index, source, item })
  })
  if (!todo.length) return
  if (!llm.available) {
    for (const entry of todo) {
      logItem(log, { id: entry.source.id, locale, reason: llm.unavailableReason || 'no-api-key', title: entry.source.title, policy: true })
    }
    return
  }
  const field = kind === 'skills' ? 'name' : 'title'
  const result = await completeOrNull(llm, log, {
    purpose: 'policy-titles',
    system: `把每条 title 翻译成${LANG[locale] || locale}。只翻译标题，不要加摘要，不要评论政治或监管。保留专有名词和数字。只输出 JSON：{"items":[{"id":"","title":""}]}`,
    user: JSON.stringify({ items: todo.map((entry) => ({ id: entry.source.id, title: entry.source.title })) }),
    maxTokens: 1500,
  })
  const rows = result.payload ? indexRows(result.payload) : new Map()
  for (const entry of todo) {
    const translated = rows.get(entry.source.id)?.title
    const verdict = translated
      ? validateTranslatedTitle({ sourceTitle: entry.source.title, translated })
      : { ok: false, reason: result.reason || 'missing-from-llm' }
    if (!verdict.ok) {
      entry.item[field] = clipTitle(entry.source.title)
      if (kind === 'daily') entry.item.summary = ''
      if (kind === 'skills') entry.item.summary = ''
      logItem(log, { id: entry.source.id, locale, reason: verdict.reason, title: entry.source.title, policy: true })
      continue
    }
    entry.item[field] = cleanText(translated)
    if (kind === 'daily') entry.item.summary = ''
    if (kind === 'skills') entry.item.summary = ''
    log.info(`policy title translated id=${entry.source.id} locale=${locale}`)
  }
}

function fallbackLocaleItem(base, source, locale, kind) {
  if (kind === 'skills') {
    const item = sourceSkill(source, locale)
    item.platform = base.platform
    item.sourceType = base.sourceType
    item.publishedAt = base.publishedAt
    item.access = base.access
    if (base.relatedUrl) {
      item.relatedUrl = base.relatedUrl
      if (base.relatedName) item.relatedName = base.relatedName
    }
    if (source.policy || base.category === '政策与监管' || (base.summary === '' && base.access === 'na' && source.policy)) {
      item.summary = ''
      item.howTo = ''
      item.access = 'na'
      delete item.accessNote
    }
    return item
  }
  const item = sourceDaily(source, locale)
  item.category = base.category
  item.access = base.access
  item.usable = base.usable
  if (base.category === '政策与监管') {
    item.summary = ''
    delete item.accessNote
  }
  return item
}

async function translateLocales({ kind, issue, prepared, llm, log, modeReason }) {
  const locales = {}
  const byUrl = new Map(prepared.map((candidate) => [candidate.url, candidate]))
  if (modeReason) {
    for (const slug of LOCALE_SLUGS) {
      locales[slug] = {
        date: issue.date,
        updatedAt: issue.updatedAt,
        intro: INTRO[kind][slug](issue.items.length),
        items: issue.items.map((item) => fallbackLocaleItem(item, byUrl.get(item.sourceUrl), slug, kind)),
      }
      const ids = issue.items.map((item) => byUrl.get(item.sourceUrl)?.id).filter(Boolean).join(',')
      log.info(`fallback locale=${slug} reason=${modeReason} ids=${ids}`)
    }
    return locales
  }

  for (const group of GROUPS) {
    const payloadItems = issue.items.map((item) => {
      const source = byUrl.get(item.sourceUrl)
      const policy = source?.policy || item.category === '政策与监管'
      if (kind === 'skills') {
        return policy
          ? { id: source.id, policy: true, name: source.title }
          : {
            id: source.id,
            policy: false,
            name: item.name,
            summary: item.summary,
            howTo: item.howTo,
            accessNote: item.accessNote || '',
            sourceName: item.sourceName,
            relatedName: item.relatedName || '',
            sourceTitle: source.title,
          }
      }
      return policy
        ? { id: source.id, policy: true, title: source.title }
        : {
          id: source.id,
          policy: false,
          title: item.title,
          summary: item.summary,
          accessNote: item.accessNote || '',
          sourceName: item.sourceName,
          sourceTitle: source.title,
        }
    })
    const result = await completeOrNull(llm, log, {
      purpose: kind === 'skills' ? 'skills-translate' : 'daily-translate',
      system: translateSystem(kind),
      user: JSON.stringify({
        languages: Object.fromEntries(group.map((slug) => [slug, LANG[slug]])),
        intro: issue.intro,
        items: payloadItems,
      }),
      maxTokens: 6000,
    })
    for (const slug of group) {
      const block = result.payload?.[slug]
      const rows = new Map()
      for (const row of block?.items || []) {
        if (row?.id) rows.set(row.id, row)
      }
      const introCheck = block ? validateIntro(block.intro) : { ok: false, reason: result.reason || 'missing-from-llm' }
      const items = issue.items.map((item) => {
        const source = byUrl.get(item.sourceUrl)
        const policy = source.policy || item.category === '政策与监管'
        const row = rows.get(source.id)
        if (!result.payload || !row) {
          logItem(log, { id: source.id, locale: slug, reason: result.reason || 'missing-from-llm', title: source.title, policy })
          return fallbackLocaleItem(item, source, slug, kind)
        }
        if (policy) {
          const translated = kind === 'skills' ? (row.name || row.title) : row.title
          const verdict = validateTranslatedTitle({ sourceTitle: source.title, translated })
          const next = fallbackLocaleItem(item, source, slug, kind)
          if (!verdict.ok) {
            logItem(log, { id: source.id, locale: slug, reason: verdict.reason, title: source.title, policy: true })
            return next
          }
          if (kind === 'skills') next.name = cleanText(translated)
          else next.title = cleanText(translated)
          next.summary = ''
          log.info(`policy title translated id=${source.id} locale=${slug}`)
          return next
        }
        const title = kind === 'skills' ? (row.name || row.title) : row.title
        const titleCheck = validateTranslatedTitle({ sourceTitle: source.title, translated: title })
        const bodyCheck = validateTranslatedBody({
          sourceTitle: source.title,
          sourceSummary: kind === 'skills' ? item.summary : item.summary,
          translated: row.summary,
        })
        if (!titleCheck.ok || !bodyCheck.ok) {
          logItem(log, {
            id: source.id,
            locale: slug,
            reason: !titleCheck.ok ? titleCheck.reason : bodyCheck.reason,
            title: source.title,
          })
          return fallbackLocaleItem(item, source, slug, kind)
        }
        const next = { ...item }
        if (kind === 'skills') next.name = cleanText(title)
        else next.title = cleanText(title)
        next.summary = cleanText(row.summary)
        const note = noteOrEmpty(row.accessNote)
        if (note) next.accessNote = note
        else delete next.accessNote
        const sourceName = noteOrEmpty(row.sourceName)
        if (sourceName) next.sourceName = sourceName
        if (kind === 'skills') {
          const howTo = inventedHowTo(row.howTo, source) ? '' : noteOrEmpty(row.howTo)
          next.howTo = howTo
          const relatedName = noteOrEmpty(row.relatedName)
          if (relatedName && next.relatedUrl) next.relatedName = relatedName
        }
        return next
      })
      locales[slug] = {
        date: issue.date,
        updatedAt: issue.updatedAt,
        intro: introCheck.ok ? cleanText(block.intro) : INTRO[kind][slug](items.length),
        items,
      }
      if (!introCheck.ok) logItem(log, { id: `${kind}-intro`, locale: slug, reason: introCheck.reason, title: '' })
    }
  }
  return locales
}

export async function buildDigest({ kind, candidates, llm, log, now = new Date() }) {
  const { issue, prepared, modeReason } = await composeIssue({ kind, candidates, llm, log, now })
  const llmDown = modeReason === 'policy-only' ? '' : modeReason
  if (!llmDown && llm.available) {
    await translatePolicyTitles(issue.items, prepared, llm, log, 'zh-cn', kind)
  }
  const locales = await translateLocales({ kind, issue, prepared, llm, log, modeReason: llmDown })
  return { issue, locales, prepared }
}

export async function publishDigest(dir, folder, issue, locales, assertIssue) {
  assertIssue(issue)
  for (const locale of Object.values(locales)) {
    assertIssue(locale)
    assertSameShape(issue, locale)
  }
  await writeJsonAtomic(dir, `${folder}/latest.json`, issue, { pretty: true })
  await writeJsonAtomic(dir, `${folder}/${issue.date}.json`, issue, { pretty: true })
  for (const [slug, locale] of Object.entries(locales)) {
    await writeJsonAtomic(dir, `${folder}/latest.${slug}.json`, locale, { pretty: true })
    await writeJsonAtomic(dir, `${folder}/${issue.date}.${slug}.json`, locale, { pretty: true })
  }
}

function countDirect(issue) {
  return issue.items.filter((item) => item.usable && item.access === 'direct').length
}

export async function runDigests({ dir, log, llm, githubToken = '', now = new Date() }) {
  let failed = false
  const news = await collectNews(log, now)
  if (!news.length) {
    log.error('ai-daily kept previous issue: no source items')
    failed = true
  } else {
    try {
      const built = await buildDigest({ kind: 'daily', candidates: news, llm, log, now })
      await publishDigest(dir, 'ai-daily', built.issue, built.locales, assertDailyIssue)
      log.info(`ai-daily published date=${built.issue.date} items=${built.issue.items.length} directUsable=${countDirect(built.issue)} updatedAt=${built.issue.updatedAt}`)
    } catch (error) {
      log.error(`ai-daily kept previous issue: ${error.message}`)
      failed = true
    }
  }

  const skills = await collectSkills(log, now, githubToken)
  if (!skills.length) {
    log.error('ai-skills kept previous issue: no source items')
    failed = true
  } else {
    try {
      const built = await buildDigest({ kind: 'skills', candidates: skills, llm, log, now })
      await publishDigest(dir, 'ai-skills', built.issue, built.locales, assertSkillsIssue)
      const direct = built.issue.items.filter((item) => item.access === 'direct').length
      log.info(`ai-skills published date=${built.issue.date} items=${built.issue.items.length} direct=${direct} updatedAt=${built.issue.updatedAt}`)
    } catch (error) {
      log.error(`ai-skills kept previous issue: ${error.message}`)
      failed = true
    }
  }
  return { failed }
}
