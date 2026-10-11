import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { BOARDS, buildArenaRelease, publishArena } from '../arena.mjs'
import { buildDigest, publishDigest } from '../digest.mjs'
import { capPerRepo, mentionsAi, releaseTitle } from '../lib/collect.mjs'
import { parseFeed } from '../lib/rss.mjs'
import { assertDailyIssue, assertSkillsIssue } from '../lib/schema.mjs'
import { createLogger } from '../lib/log.mjs'
import { isPolicySource, validateRewrite, validateTranslatedBody, validateTranslatedTitle } from '../lib/validate.mjs'
import { parseAiDailyIssue } from '../../../src/ai-daily/issue.ts'
import { parseAiSkillsIssue } from '../../../src/ai-skills/issue.ts'
import { computeBattle } from '../../../src/arena/battle.ts'

const log = createLogger('')

function row(model, org, rating, rank, votes = 5000) {
  return { model, org, rating, ratingLower: rating - 8, ratingUpper: rating + 8, votes, rank }
}

function tablesFrom(models) {
  const tables = {}
  for (const board of BOARDS) {
    tables[board.key] = {
      updated: '2026-10-08',
      rows: models.map((model, index) => row(
        model.id,
        model.org,
        model.base - index - (board.key === 'text' ? 0 : index),
        index + 1,
        4000 + index * 100,
      )),
    }
  }
  return tables
}

test('arena release matches the index.json contract and can fight', () => {
  const models = [
    ['claude-opus-5.5-high', 'anthropic'],
    ['claude-opus-4-6-high', 'anthropic'],
    ['gpt-6.1-sol-max', 'openai'],
    ['gpt-5.6-sol-xhigh', 'openai'],
    ['gemini-4-argon-high', 'google'],
    ['gemini-3.8-flash-high', 'google'],
    ['qwen3.8-max', 'alibaba'],
    ['qwen3.7-max-preview', 'alibaba'],
  ].map(([id, org], index) => ({ id, org, base: 1520 - index }))
  const release = buildArenaRelease({
    tables: tablesFrom(models),
    seen: { seededAt: '2026-10-01', models: Object.fromEntries(models.map((model) => [model.id, '2026-10-01'])) },
    now: new Date('2026-10-11T00:30:00Z'),
  })
  assert.equal(release.index.v, 2)
  assert.equal(release.index.date, '2026-10-11')
  assert.match(release.index.updatedAt, /\+08:00$/)
  assert.equal(release.index.boards.length, 13)
  assert.ok(release.index.boards.every((board) => board.span >= 30))
  assert.equal(release.latest.version, 1)
  assert.equal(release.latest.updatedAt, release.index.updatedAt)
  const data = fromIndex(release.index)
  for (const [vendor, file] of Object.entries(release.vendorFiles)) {
    putRows(data, file)
    assert.equal(typeof file, 'object')
    assert.ok(vendor)
  }
  const battle = computeBattle(data, release.index.featured.left, release.index.featured.right)
  assert.ok(battle)
  assert.ok(battle.rounds.length >= 1)
  assert.ok(battle.rounds.every((round) => Number.isFinite(round.damage)))
  const newcomer = 'new-model-1'
  const again = buildArenaRelease({
    tables: tablesFrom([...models, { id: newcomer, org: 'deepseek', base: 1400 }]),
    seen: release.seen,
    now: new Date('2026-10-11T00:30:00Z'),
  })
  const added = again.index.models.find((row) => row[0] === newcomer)
  assert.equal(added[5] & 1, 1)
})

test('llm refusal, length, and missing names fall back to the source text', async () => {
  const candidates = [
    candidate('n1', 'Anthropic releases Claude Opus 5.5', 'Anthropic published Claude Opus 5.5 with a new API tier and a public model card.'),
    candidate('n2', 'Qwen-Image-2.1 lands on GitHub', 'Alibaba shipped Qwen-Image-2.1 weights on GitHub for local image generation.'),
  ]
  candidates[1].url = 'https://github.com/QwenLM/Qwen-Image-2.1'
  const llm = scripted((body) => ({
    intro: 'Anthropic 发布了 Claude Opus 5.5，阿里也把 Qwen-Image-2.1 放到了 GitHub。',
    items: [
      {
        id: 'n1',
        category: '模型与产品',
        title: 'I cannot summarize this request',
        summary: 'I cannot assist with that request because of the content policy, so this answer is intentionally not a summary of the source.',
        access: 'restricted',
        accessNote: '需要海外账号。',
        usable: true,
      },
      {
        id: 'n2',
        category: '开源与工具',
        title: 'Qwen-Image-2.1 已在 GitHub 放出权重',
        summary: '阿里巴巴把 Qwen-Image-2.1 的权重放到了 GitHub，读者可以打开仓库下载，用于本地图片生成。页面写明这是开放权重。',
        access: 'direct',
        accessNote: 'GitHub 仓库一般可以直接打开。',
        usable: true,
      },
    ].map((item) => item),
  }))
  const built = await buildDigest({ kind: 'daily', candidates, llm, log, now: new Date('2026-10-11T00:30:00Z') })
  parseAiDailyIssue(built.issue)
  assert.equal(built.issue.items[0].title, candidates[0].title)
  assert.match(built.issue.items[0].summary, /Anthropic published Claude Opus/)
  assert.equal(built.issue.items[1].title, 'Qwen-Image-2.1 已在 GitHub 放出权重')
  assert.equal(built.issue.items[1].access, 'direct')
  assert.equal(built.issue.items[1].usable, true)
  assert.equal(built.issue.items[1].sourceUrl, candidates[1].url)
})

test('short, long, and off-topic summaries fall back', () => {
  const sourceTitle = 'Anthropic releases Claude Opus 5.5'
  const sourceSnippet = 'Anthropic published Claude Opus 5.5 with a new API tier and a public model card for developers.'
  assert.equal(validateRewrite({
    sourceTitle,
    sourceSnippet,
    title: 'Anthropic 发布 Claude Opus 5.5',
    summary: '短',
  }).reason, 'summary-too-short')
  assert.equal(validateRewrite({
    sourceTitle,
    sourceSnippet,
    title: 'Anthropic 发布 Claude Opus 5.5',
    summary: `${'Anthropic Claude Opus 5.5 '.repeat(40)}额外的说明`,
  }).reason, 'summary-too-long')
  const missing = validateRewrite({
    sourceTitle,
    sourceSnippet,
    title: '一家实验室更新了产品线',
    summary: '今天有一家实验室更新了自己的产品线，并表示后续还会继续调整接口和价格，细节仍以原页面为准。官方只给了一般性说明，没有点名具体型号，也没有给出可核对的版本号。',
  })
  assert.equal(missing.ok, false)
  assert.match(missing.reason, /^missing-entities:/)
})

test('policy items keep the original title and link, with no rewritten summary', async () => {
  const policy = candidate('n1', 'US Congress proposes new AI export controls', 'Lawmakers outlined export controls for advanced chips.')
  const normal = candidate('n2', 'DeepSeek posts V4 weights on GitHub', 'DeepSeek published V4 model weights in a public GitHub repository.')
  normal.url = 'https://github.com/deepseek-ai/DeepSeek-V4'
  let sawPolicyInPrompt = false
  const llm = scripted((body, purpose) => {
    if (purpose === 'daily-compose') {
      sawPolicyInPrompt = JSON.stringify(body).includes('Congress')
      return {
        intro: 'DeepSeek 在 GitHub 发布了 V4 权重，读者可以直接打开仓库。',
        items: [{
          id: 'n2',
          category: '开源与工具',
          title: 'DeepSeek 在 GitHub 发布 V4 权重',
          summary: 'DeepSeek 把 V4 模型权重放进了公开的 GitHub 仓库，读者可以打开仓库查看和下载。',
          access: 'restricted',
          accessNote: '仓库页面可以打开。',
          usable: true,
        }],
      }
    }
    return null
  })
  const built = await buildDigest({ kind: 'daily', candidates: [policy, normal], llm, log, now: new Date('2026-10-11T00:30:00Z') })
  assert.equal(sawPolicyInPrompt, false)
  assert.equal(isPolicySource(policy.title, policy.snippet), true)
  const item = built.issue.items[0]
  assert.equal(item.category, '政策与监管')
  assert.equal(item.title, policy.title)
  assert.equal(item.summary, '')
  assert.equal(item.sourceUrl, policy.url)
  assert.equal(item.usable, false)
  parseAiDailyIssue(built.issue)
  const en = built.locales.en.items[0]
  assert.equal(en.summary, '')
  assert.equal(en.sourceUrl, policy.url)
  assert.ok(en.title)
})

test('no API key still publishes source titles and links', async () => {
  const items = [
    candidate('n1', 'Anthropic releases Claude Opus 5.5', 'Anthropic published Claude Opus 5.5 with a new API tier and a public model card.'),
    candidate('s1', 'anthropics/skills', 'Official Agent Skills repository for Claude, including document skills.'),
  ]
  const llm = { available: false, unavailableReason: 'no-api-key', async completeJson() { throw new Error('should not be called') } }
  const daily = await buildDigest({ kind: 'daily', candidates: [items[0]], llm, log, now: new Date('2026-10-11T00:30:00Z') })
  assert.equal(daily.issue.items[0].title, items[0].title)
  assert.match(daily.issue.items[0].summary, /public model card/)
  assert.equal(daily.issue.items[0].sourceUrl, items[0].url)
  parseAiDailyIssue(daily.issue)
  for (const locale of Object.values(daily.locales)) {
    parseAiDailyIssue(locale)
    assert.equal(locale.updatedAt, daily.issue.updatedAt)
    assert.equal(locale.items.length, daily.issue.items.length)
  }
  const skills = await buildDigest({
    kind: 'skills',
    candidates: [{ ...items[1], platform: 'Claude', sourceType: 'github', publishedAt: '2026-10-10', relatedUrl: '', relatedName: '' }],
    llm,
    log,
    now: new Date('2026-10-11T00:30:00Z'),
  })
  parseAiSkillsIssue(skills.issue)
  assert.equal(skills.issue.items[0].name, 'anthropics/skills')
  assert.equal(skills.issue.items[0].sourceUrl, items[1].url)
  assert.equal(skills.issue.items[0].howTo, '')
})

test('unreachable LLM publishes originals instead of keeping a broken file', async () => {
  const llm = {
    available: true,
    unavailableReason: '',
    async completeJson() {
      const error = new Error('llm timeout daily-compose')
      error.status = 0
      throw error
    },
  }
  const source = candidate('n1', 'Google ships Gemini 3.8 Flash', 'Google released Gemini 3.8 Flash to the Gemini app and API with a higher rate limit.')
  const built = await buildDigest({ kind: 'daily', candidates: [source], llm, log, now: new Date('2026-10-11T00:30:00Z') })
  assert.equal(built.issue.items[0].title, source.title)
  assert.match(built.issue.items[0].summary, /rate limit/)
  parseAiDailyIssue(built.issue)
})

test('a failed publish leaves yesterday in place and does not delete other files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'maotai-keep-'))
  const folder = path.join(dir, 'ai-daily')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(folder, { recursive: true })
  const previous = { date: '2026-10-10', updatedAt: '2026-10-10T07:30:00+08:00', intro: 'yesterday', items: [] }
  await writeFile(path.join(folder, 'latest.json'), `${JSON.stringify(previous)}\n`)
  await writeFile(path.join(folder, 'keep.txt'), 'leave me\n')
  await assert.rejects(() => publishDigest(dir, 'ai-daily', { date: '2026-10-11', updatedAt: '', intro: '', items: [] }, {}, assertDailyIssue))
  assert.equal(await readFile(path.join(folder, 'latest.json'), 'utf8'), `${JSON.stringify(previous)}\n`)
  assert.equal(await readFile(path.join(folder, 'keep.txt'), 'utf8'), 'leave me\n')
})

test('rss parser keeps real links from rss and atom', () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Claude <b>Opus</b></title><link>https://example.com/claude?utm_source=feed</link><pubDate>Sat, 10 Oct 2026 01:00:00 GMT</pubDate><description><![CDATA[A real note about Claude.]]></description></item></channel></rss>`
  const atom = `<?xml version="1.0"?><feed><entry><title>Qwen release</title><link rel="alternate" href="http://arxiv.org/abs/2610.10001"/><published>2026-10-10T00:00:00Z</published><summary>Paper summary.</summary></entry></feed>`
  const rssItems = parseFeed(rss)
  assert.equal(rssItems[0].title, 'Claude Opus')
  assert.equal(rssItems[0].url, 'https://example.com/claude?utm_source=feed')
  assert.match(rssItems[0].snippet, /real note/)
  const atomItems = parseFeed(atom)
  assert.equal(atomItems[0].url, 'https://arxiv.org/abs/2610.10001')
})

test('broad sources need a real AI word, and politics stays title-only', async () => {
  assert.equal(mentionsAi('Dwarf Fortress uses version control now. The available details are here.'), false)
  assert.equal(mentionsAi('Learning to use local AI is frustrating'), true)
  assert.equal(isPolicySource('Silicon Valley is falling in line with Trump’s attempt to rename AI', ''), true)
  const release = candidate('n1', 'Claude Code v2.1.295', 'This release raises the default timeout for hooks and documents the new flag.')
  release.url = 'https://github.com/anthropics/claude-code/releases/tag/v2.1.295'
  const llm = { available: false, unavailableReason: 'no-api-key', async completeJson() { throw new Error('should not be called') } }
  const built = await buildDigest({ kind: 'daily', candidates: [release], llm, log, now: new Date('2026-10-11T00:30:00Z') })
  assert.equal(built.issue.items[0].category, '开源与工具')
  assert.equal(built.issue.items[0].access, 'direct')
  assert.equal(releaseTitle('v2.1.296', release.url), 'anthropics/claude-code v2.1.296')
  const capped = capPerRepo([
    { url: 'https://github.com/anthropics/claude-code/releases/tag/v1', publishedAt: '2026-10-01' },
    { url: 'https://github.com/anthropics/claude-code/releases/tag/v2', publishedAt: '2026-10-02' },
    { url: 'https://github.com/anthropics/claude-code/releases/tag/v3', publishedAt: '2026-10-03' },
    { url: 'https://github.com/qwen/qwen/releases/tag/v1', publishedAt: '2026-10-03' },
  ], 2)
  assert.deepEqual(capped.map((item) => item.url), [
    'https://github.com/anthropics/claude-code/releases/tag/v3',
    'https://github.com/qwen/qwen/releases/tag/v1',
    'https://github.com/anthropics/claude-code/releases/tag/v2',
  ])
})

test('translations accept missing names and locales stay aligned with zh', async () => {
  const samples = [
    ['Remote control for local agents', '本地代理可以远程操控', '读者可以在另一台机器上操作本机上的代理，页面保留原始链接。'],
    ['GitHub Copilot weekly releases — October 5', 'Copilot 的每周更新', '每周更新说明已经发布，读者可以打开页面查看这次更新。'],
    ['anthropics/claude-code v2.1.295', 'claude-code 小版本更新', '仓库发布了一个小版本，读者可以打开发布页查看变更。'],
    ['CakeCrusher/repo-skill', '一个技能仓库更新了', '这个技能仓库更新了使用说明，读者可以打开页面查看。'],
  ]
  for (const [sourceTitle, title, summary] of samples) {
    assert.equal(validateTranslatedTitle({ sourceTitle, translated: title }).ok, true, sourceTitle)
    assert.equal(validateTranslatedBody({
      sourceTitle,
      sourceSummary: `${sourceTitle} with enough original detail for a length check.`,
      translated: summary,
    }).ok, true, sourceTitle)
  }
  assert.equal(validateTranslatedTitle({ sourceTitle: 'Claude Opus', translated: '' }).reason, 'title-empty')
  assert.equal(validateTranslatedBody({
    sourceTitle: 'Claude Opus',
    sourceSummary: 'Claude published a note for developers today.',
    translated: 'I cannot assist with that request.',
  }).reason, 'llm-refusal')
  assert.equal(validateTranslatedBody({
    sourceTitle: 'Claude Opus',
    sourceSummary: 'Claude published a note for developers today.',
    translated: '短',
  }).reason, 'summary-too-short')

  const llm = {
    available: true,
    unavailableReason: '',
    async completeJson({ purpose, user }) {
      const body = JSON.parse(user)
      if (purpose === 'daily-compose') {
        return {
          intro: 'Cursor 增加了 remote control，读者可以打开原始页面。',
          items: [{
            id: 'n1',
            category: '模型与产品',
            title: 'Cursor remote control 可以操作本地代理',
            summary: 'Cursor 增加了 remote control，读者可以在另一台机器上操作本机代理。说明页保留了原始链接供核对。',
            access: 'restricted',
            accessNote: '',
            usable: true,
          }],
        }
      }
      if (purpose === 'daily-translate') {
        const out = {}
        for (const slug of Object.keys(body.languages)) {
          out[slug] = {
            intro: 'A public source list for today, with the original link kept on the item.',
            items: [{
              id: 'n1',
              title: '可以在另一台机器上操作本机代理',
              summary: '产品说明介绍了如何从另一台机器操作本机上的代理，并保留了原始链接。',
              accessNote: '',
              sourceName: 'Example',
            }],
          }
        }
        return out
      }
      return { items: [] }
    },
  }
  const source = candidate('n1', 'Cursor ships remote control for local agents', 'Cursor added remote control so a local agent can be driven from another machine.')
  const built = await buildDigest({ kind: 'daily', candidates: [source], llm, log, now: new Date('2026-10-11T00:30:00Z') })
  assert.equal(built.locales.en.items[0].title, '可以在另一台机器上操作本机代理')
  for (const locale of Object.values(built.locales)) {
    parseAiDailyIssue(locale)
    assert.equal(locale.date, built.issue.date)
    assert.equal(locale.updatedAt, built.issue.updatedAt)
    assert.equal(locale.items.length, built.issue.items.length)
    assert.equal(locale.items[0].sourceUrl, built.issue.items[0].sourceUrl)
  }
})

test('arena seen.json keeps departed models and is not replaced when unreadable', async () => {
  const models = [
    ['claude-opus-5.5-high', 'anthropic'],
    ['claude-opus-4-6-high', 'anthropic'],
    ['gpt-6.1-sol-max', 'openai'],
    ['gpt-5.6-sol-xhigh', 'openai'],
    ['gemini-4-argon-high', 'google'],
    ['gemini-3.8-flash-high', 'google'],
    ['qwen3.8-max', 'alibaba'],
    ['qwen3.7-max-preview', 'alibaba'],
  ].map(([id, org], index) => ({ id, org, base: 1520 - index }))
  const prior = {
    seededAt: '2026-10-01',
    models: {
      'gone-model': '2026-09-01',
      'claude-opus-5.5-high': '2026-10-01',
    },
  }
  const release = buildArenaRelease({
    tables: tablesFrom(models),
    seen: prior,
    now: new Date('2026-10-11T00:30:00Z'),
  })
  assert.equal(release.seen.models['gone-model'], '2026-09-01')
  const dir = await mkdtemp(path.join(tmpdir(), 'maotai-seen-'))
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path.join(dir, 'arena-data'), { recursive: true })
  const seenPath = path.join(dir, 'arena-data', 'seen.json')
  await writeFile(seenPath, `${JSON.stringify(prior)}\n`)
  await publishArena(dir, release)
  const written = JSON.parse(await readFile(seenPath, 'utf8'))
  assert.equal(written.models['gone-model'], '2026-09-01')
  assert.equal(written.seededAt, '2026-10-01')
  const stripped = {
    ...release,
    seen: { seededAt: '2026-10-12', models: { 'claude-opus-5.5-high': '2026-10-12' } },
  }
  await publishArena(dir, stripped)
  const kept = JSON.parse(await readFile(seenPath, 'utf8'))
  assert.equal(kept.seededAt, '2026-10-01')
  assert.equal(kept.models['gone-model'], '2026-09-01')
  assert.equal(kept.models['claude-opus-5.5-high'], '2026-10-01')
  await writeFile(seenPath, '{')
  await assert.rejects(() => publishArena(dir, release), /refusing to replace/)
  assert.equal(await readFile(seenPath, 'utf8'), '{')
})

test('skills issue passes the frontend parser', async () => {
  const llm = scripted(() => ({
    intro: 'GitHub 上的 anthropics/skills 更新了文档技能，仓库可以直接打开。',
    items: [{
      id: 's1',
      platform: 'Claude',
      name: 'anthropics/skills 文档技能',
      summary: 'anthropics/skills 仓库新增了文档技能，读者可以打开 GitHub 仓库查看安装说明。',
      howTo: '按仓库 README 安装。',
      access: 'direct',
      accessNote: 'GitHub 一般可以直接打开。',
      sourceName: 'GitHub',
    }],
  }))
  const built = await buildDigest({
    kind: 'skills',
    candidates: [{
      id: 's1',
      title: 'anthropics/skills',
      url: 'https://github.com/anthropics/skills',
      sourceName: 'GitHub · anthropics/skills',
      publishedAt: '2026-10-10',
      snippet: 'Anthropic published anthropics/skills with document skills for Claude.',
      platform: 'Claude',
      sourceType: 'github',
      relatedUrl: '',
      relatedName: '',
    }],
    llm,
    log,
    now: new Date('2026-10-11T00:30:00Z'),
  })
  const parsed = parseAiSkillsIssue(built.issue)
  assert.equal(parsed.items[0].sourceUrl, 'https://github.com/anthropics/skills')
  assert.equal(parsed.items[0].platform, 'Claude')
  assertSkillsIssue(built.issue)
})

function candidate(id, title, snippet) {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    sourceName: 'Example',
    publishedAt: '2026-10-10',
    snippet,
  }
}

function scripted(handler) {
  return {
    available: true,
    unavailableReason: '',
    async completeJson({ purpose, user }) {
      const body = JSON.parse(user)
      if (purpose === 'policy-titles') {
        return { items: body.items.map((item) => ({ id: item.id, title: item.title })) }
      }
      if (purpose === 'daily-translate' || purpose === 'skills-translate') {
        const out = {}
        for (const slug of Object.keys(body.languages)) {
          out[slug] = {
            intro: 'A neutral public-source list for today, with original links kept on every item.',
            items: body.items.map((item) => ({
              id: item.id,
              title: item.title,
              name: item.name || item.title,
              summary: item.policy ? '' : (item.summary || item.title),
              howTo: item.howTo || '',
              accessNote: '',
              sourceName: 'Example',
            })),
          }
        }
        return out
      }
      const made = handler(body, purpose)
      if (made) return made
      return { intro: '今天的公开来源列表已经整理好，每条保留原始链接。', items: [] }
    },
  }
}

function fromIndex(j) {
  const boards = j.boards.map((b) => ({
    key: b.k,
    source: j.source,
    url: b.url,
    leaderboardUpdated: b.upd,
    totalVotes: b.tv,
    fetchedAt: b.at,
    poolSpan: b.span,
    models: {},
  }))
  const vendors = {}
  for (const [id, name, avatar, color, count] of j.vendors) vendors[id] = { id, name, avatar, color, count }
  const models = {}
  for (const [id, label, vi, mask, comp, flags] of j.models) {
    const vendor = j.vendors[vi]
    models[id] = {
      id,
      label,
      avatar: vendor[2],
      vendor: vendor[0],
      comp,
      isNew: Boolean(flags & 1),
      boards: boards.filter((_, i) => mask & (1 << i)).map((b) => b.key),
    }
  }
  const data = { version: 2, date: j.date, updatedAt: j.updatedAt, featured: j.featured, models, boards, vendors }
  putRows(data, j.inline)
  return data
}

function putRows(data, rows) {
  for (const [id, per] of Object.entries(rows)) {
    for (const [bi, r] of Object.entries(per)) {
      const board = data.boards[Number(bi)]
      if (board) board.models[id] = { score: r[0], ciUp: r[1], ciDown: r[2], votes: r[3], preliminary: Boolean(r[4]) }
    }
  }
}
