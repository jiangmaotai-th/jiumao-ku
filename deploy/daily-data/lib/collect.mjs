import { fetchText, normalizeUrl, parseFeed } from './rss.mjs'
import { addDays, dayFromAny, shanghaiParts } from './time.mjs'

const NEWS_FEEDS = [
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', broad: false },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/', broad: false },
  { name: 'Google AI (innovation)', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/', broad: false },
  { name: 'DeepMind', url: 'https://deepmind.google/blog/rss.xml', broad: false },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', broad: false },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', broad: false },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', broad: false },
  { name: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/', broad: false },
  { name: 'Qwen Blog', url: 'https://qwenlm.github.io/blog/index.xml', broad: false },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', broad: true },
  { name: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/', broad: true },
  { name: 'Microsoft Research', url: 'https://www.microsoft.com/en-us/research/feed/', broad: true },
]

const SKILL_FEEDS = [
  { name: 'Anthropic Skills', url: 'https://github.com/anthropics/skills/releases.atom', platform: 'Claude', sourceType: 'github' },
  { name: 'Claude Code', url: 'https://github.com/anthropics/claude-code/releases.atom', platform: 'Claude', sourceType: 'github' },
  { name: 'Cursor Changelog', url: 'https://cursor.com/changelog/rss.xml', platform: 'Cursor', sourceType: 'official' },
  { name: 'Qwen releases', url: 'https://github.com/QwenLM/Qwen/releases.atom', platform: '通用', sourceType: 'github' },
  { name: 'DeepSeek releases', url: 'https://github.com/deepseek-ai/DeepSeek-V3/releases.atom', platform: '通用', sourceType: 'github' },
  { name: 'GLM releases', url: 'https://github.com/THUDM/GLM/releases.atom', platform: '通用', sourceType: 'github' },
]

const AI_WORD = /\b(?:ai|llm|gpt|claude|gemini|chatgpt|agent|openai|anthropic|deepseek|qwen|copilot|llama)\b|模型|智能|机器学习|machine learning/i
const SKILL_WORD = /skill|plugin|extension|mcp|copilot|cursor|codex|agent|规则|插件|技能/i

function repoUrl(releaseUrl) {
  const match = String(releaseUrl).match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/i)
  return match ? `https://github.com/${match[1]}` : ''
}

async function mapPool(items, limit, worker) {
  const out = []
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      try {
        const value = await worker(items[index], index)
        if (value) out.push(value)
      } catch (error) {
        out.push({ error })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return out
}

function dedupe(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const url = normalizeUrl(item.url)
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ ...item, url })
  }
  return out
}

function diversify(items, limit) {
  const groups = new Map()
  for (const item of items) {
    const key = item.sourceName
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  const out = []
  while (out.length < limit) {
    let added = false
    for (const group of groups.values()) {
      if (!group.length) continue
      out.push(group.shift())
      added = true
      if (out.length >= limit) break
    }
    if (!added) break
  }
  return out
}

async function readFeed(feed, log) {
  try {
    const xml = await fetchText(feed.url, { timeout: 20000 })
    return parseFeed(xml).map((item) => ({ ...item, sourceName: feed.name, feed }))
  } catch (error) {
    log.error(`feed failed ${feed.name}: ${error.message}`)
    return []
  }
}

/**
 * Real public items only. Returns [] when every source fails; the caller
 * keeps yesterday rather than writing an empty issue.
 */
export async function collectNews(log, now = new Date()) {
  const today = shanghaiParts(now).date
  const windows = [3, 7]
  let raw = []
  const feeds = await mapPool(NEWS_FEEDS, 4, (feed) => readFeed(feed, log))
  for (const result of feeds) {
    if (result?.error || !Array.isArray(result)) continue
    raw.push(...result)
  }
  const hn = await collectHn(log, today)
  raw.push(...hn)
  const arxiv = await collectArxiv(log)
  raw.push(...arxiv)

  raw = raw.filter((item) => {
    if (item.feed?.broad && !mentionsAi(`${item.title} ${item.snippet}`)) return false
    return true
  })

  for (const days of windows) {
    const minDay = addDays(today, -days)
    const picked = dedupe(raw.filter((item) => {
      const day = dayFromAny(item.date)
      return day && day >= minDay && day <= today
    }))
    if (picked.length >= 6 || days === windows.at(-1)) {
      const items = diversify(picked.sort((a, b) => String(b.date).localeCompare(String(a.date))), 18)
        .map((item, index) => ({
          id: `n${index + 1}`,
          kind: 'news',
          title: item.title,
          url: item.url,
          sourceName: item.sourceName,
          publishedAt: dayFromAny(item.date),
          snippet: item.snippet || '',
        }))
      log.info(`news candidates=${items.length} windowDays=${days}`)
      return items
    }
  }
  return []
}

async function collectHn(log, today) {
  const queries = ['LLM', 'Claude', 'Gemini']
  const since = Math.floor(Date.now() / 1000) - 7 * 86400
  const out = []
  for (const query of queries) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=${encodeURIComponent(`created_at_i>${since},points>15`)}&hitsPerPage=8`
    try {
      const payload = JSON.parse(await fetchText(url, { accept: 'application/json', timeout: 20000 }))
      for (const hit of payload.hits || []) {
        const link = normalizeUrl(hit.url || hit.story_url || '')
        const discussion = `https://news.ycombinator.com/item?id=${hit.objectID}`
        out.push({
          title: hit.title || '',
          url: link || discussion,
          date: hit.created_at || '',
          snippet: `${hit.points || 0} points on Hacker News. ${hit.story_text || ''}`.trim(),
          sourceName: 'Hacker News',
        })
      }
    } catch (error) {
      log.error(`hn failed ${query}: ${error.message}`)
    }
  }
  if (!out.length) log.info(`hn empty for ${today}`)
  return out
}

async function collectArxiv(log) {
  const url = 'https://export.arxiv.org/api/query?search_query=cat:cs.CL+OR+cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=8'
  try {
    const xml = await fetchText(url, { timeout: 25000 })
    return parseFeed(xml).map((item) => ({
      ...item,
      sourceName: 'arXiv',
      url: item.url.replace(/^http:\/\/arxiv\.org\//i, 'https://arxiv.org/'),
    }))
  } catch (error) {
    log.error(`arxiv failed: ${error.message}`)
    return []
  }
}

export async function collectSkills(log, now = new Date(), githubToken = '') {
  const today = shanghaiParts(now).date
  const minDay = addDays(today, -14)
  const raw = []
  const feeds = await mapPool(SKILL_FEEDS, 4, (feed) => readFeed(feed, log))
  for (const result of feeds) {
    if (!Array.isArray(result)) continue
    for (const item of result) {
      const day = dayFromAny(item.date)
      if (!day || day < minDay || day > today) continue
      const related = repoUrl(item.url)
      raw.push({
        title: releaseTitle(item.title, item.url),
        url: item.url,
        sourceName: item.sourceName,
        publishedAt: day,
        snippet: item.snippet || '',
        platform: item.feed.platform,
        sourceType: item.feed.sourceType,
        relatedUrl: related && related !== normalizeUrl(item.url) ? related : '',
        relatedName: related ? `GitHub · ${related.split('/').slice(-2).join('/')}` : '',
      })
    }
  }

  const pushed = addDays(today, -14)
  const queries = [
    `claude skill OR "agent skills" OR "cursor rules" in:name,description pushed:>=${pushed}`,
    `topic:claude-skills pushed:>=${pushed}`,
  ]
  for (const query of queries) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=8`
    try {
      const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'maotaiworks-daily/1.0',
      }
      if (githubToken) headers.Authorization = `Bearer ${githubToken}`
      const payload = JSON.parse(await fetchText(url, { accept: 'application/vnd.github+json', headers, timeout: 20000 }))
      for (const repo of payload.items || []) {
        if ((repo.stargazers_count || 0) < 5 && !/anthropic|openai|qwen|deepseek/i.test(repo.full_name || '')) continue
        raw.push({
          title: repo.full_name,
          url: repo.html_url,
          sourceName: `GitHub · ${repo.full_name}`,
          publishedAt: dayFromAny(repo.pushed_at || repo.updated_at),
          snippet: repo.description || '',
          platform: platformGuess(`${repo.full_name} ${repo.description}`),
          sourceType: 'github',
          relatedUrl: '',
          relatedName: '',
        })
      }
    } catch (error) {
      log.error(`github search failed: ${error.message}`)
    }
  }

  const changelog = await readFeed({ name: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/' }, log)
  for (const item of changelog) {
    if (!SKILL_WORD.test(`${item.title} ${item.snippet}`)) continue
    const day = dayFromAny(item.date)
    if (!day || day < minDay) continue
    raw.push({
      title: item.title,
      url: item.url,
      sourceName: 'GitHub Changelog',
      publishedAt: day,
      snippet: item.snippet || '',
      platform: platformGuess(`${item.title} ${item.snippet}`),
      sourceType: 'official',
      relatedUrl: '',
      relatedName: '',
    })
  }

  const items = diversify(dedupe(capPerRepo(raw, 2)), 14).map((item, index) => ({
    id: `s${index + 1}`,
    kind: 'skill',
    ...item,
    url: normalizeUrl(item.url),
  })).filter((item) => item.url)
  log.info(`skill candidates=${items.length}`)
  return items
}

/** Keep the newest few releases of one GitHub repo instead of a version dump. */
export function capPerRepo(items, limit = 2) {
  const counts = new Map()
  const out = []
  const sorted = [...items].sort((a, b) => String(b.publishedAt || b.date || '').localeCompare(String(a.publishedAt || a.date || '')))
  for (const item of sorted) {
    const repo = repoUrl(item.url) || normalizeUrl(item.url)
    const used = counts.get(repo) || 0
    if (used >= limit) continue
    counts.set(repo, used + 1)
    out.push(item)
  }
  return out
}

/** GitHub tag titles like v2.1.296 become "owner/repo v2.1.296". */
export function releaseTitle(title, url) {
  const text = String(title || '').trim()
  const repo = repoUrl(url)
  const name = repo ? repo.split('/').slice(-2).join('/') : ''
  if (name && /^v?\d+(?:\.\d+){1,}$/i.test(text)) return `${name} ${text}`
  return text
}

export function mentionsAi(text) {
  return AI_WORD.test(String(text || ''))
}

export function platformGuess(text) {
  const value = String(text || '')
  if (/claude/i.test(value)) return 'Claude'
  if (/chatgpt|openai|codex/i.test(value)) return 'ChatGPT'
  if (/gemini/i.test(value)) return 'Gemini'
  if (/cursor/i.test(value)) return 'Cursor'
  if (/copilot/i.test(value)) return 'Copilot'
  if (/perplexity/i.test(value)) return 'Perplexity'
  if (/manus/i.test(value)) return 'Manus'
  return '通用'
}

export function sourceTypeFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'github.com') return 'github'
    if (host === 'x.com' || host === 'twitter.com') return 'x'
    if (host.endsWith('news.ycombinator.com')) return 'hn'
    if (host.endsWith('reddit.com')) return 'reddit'
    if (['openai.com', 'anthropic.com', 'claude.com', 'blog.google', 'deepmind.google', 'cursor.com', 'github.blog', 'qwenlm.github.io', 'huggingface.co'].some((item) => host === item || host.endsWith(`.${item}`))) {
      return 'official'
    }
  } catch {
    /* fall through */
  }
  return 'other'
}
