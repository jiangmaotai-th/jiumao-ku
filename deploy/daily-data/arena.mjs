import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { fetchBuffer, fetchText } from './lib/rss.mjs'
import { writeJsonAtomic } from './lib/atomic.mjs'
import { assertArenaBoardFields, arenaBoardMeta, hasArenaBoardMapping } from './lib/board-meta.mjs'
import { daysBetween, formatLeaderboardDate, shanghaiParts } from './lib/time.mjs'

const DATASET = 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset'
const SOURCE = 'Arena.ai (LMArena)'

/** Board order is the bit order in index.json model masks. */
export const BOARDS = [
  { key: 'text', subset: 'text_style_control', category: 'overall', url: 'https://arena.ai/leaderboard/chat/text' },
  { key: 'coding', subset: 'text_style_control', category: 'coding', url: 'https://arena.ai/leaderboard/chat/text/coding' },
  { key: 'math', subset: 'text_style_control', category: 'math', url: 'https://arena.ai/leaderboard/chat/text/math' },
  { key: 'creative', subset: 'text_style_control', category: 'creative_writing', url: 'https://arena.ai/leaderboard/chat/text/creative-writing' },
  { key: 'webdev', subset: 'webdev', category: 'overall', url: 'https://arena.ai/leaderboard/code/webdev' },
  { key: 'vision', subset: 'vision_style_control', category: 'overall', url: 'https://arena.ai/leaderboard/chat/vision' },
  { key: 'search', subset: 'search_style_control', category: 'overall', url: 'https://arena.ai/leaderboard/chat/search' },
  { key: 'document', subset: 'document_style_control', category: 'overall', url: 'https://arena.ai/leaderboard/chat/document' },
  { key: 'i2webdev', subset: 'webdev', category: 'image_to_webdev', url: 'https://arena.ai/leaderboard/code/image-to-webdev' },
  { key: 't2i', subset: 'text_to_image', category: 'overall', url: 'https://arena.ai/leaderboard/image/text-to-image' },
  { key: 't2v', subset: 'text_to_video', category: 'overall', url: 'https://arena.ai/leaderboard/video/text-to-video' },
  { key: 'i2v', subset: 'image_to_video', category: 'overall', url: 'https://arena.ai/leaderboard/video/image-to-video' },
  { key: 'vedit', subset: 'video_edit', category: 'overall', url: 'https://arena.ai/leaderboard/video/video-edit' },
]

const ACRONYM = new Set(['gpt', 'ai', 'vl', 'it', 'api', 'llm', 'html', 'css', 'sql', 'tts', 'ocr', 'ui', 'fp8', 'fp16', 'bf16', 'int4', 'int8', 'moe', 'hf'])

const AVATARS = {
  openai: 'knight',
  alibaba: 'scholar',
  google: 'mage',
  anthropic: 'dragon',
  xai: 'mech',
  meta: 'meta',
  deepseek: 'whale',
  mistral: 'mistral',
  zai: 'fox',
  bytedance: 'bytedance',
  tencent: 'tencent',
  nvidia: 'nvidia',
  microsoft: 'microsoft',
  minimax: 'minimax',
  amazon: 'amazon',
  moonshot: 'rabbit',
  xiaomi: 'xiaomi',
  stepfun: 'stepfun',
  cohere: 'cohere',
  baidu: 'baidu',
}

const NAMES = {
  openai: 'OpenAI',
  alibaba: 'Alibaba (Qwen)',
  google: 'Google',
  anthropic: 'Anthropic',
  xai: 'xAI',
  meta: 'Meta',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
  zai: 'Z.ai (GLM)',
  bytedance: 'ByteDance',
  tencent: 'Tencent',
  nvidia: 'NVIDIA',
  microsoft: 'Microsoft',
  other: 'Other',
  'black-forest-labs': 'Black Forest Labs',
  minimax: 'MiniMax',
  ai2: 'Ai2',
  amazon: 'Amazon',
  ibm: 'IBM',
  moonshot: 'Moonshot (Kimi)',
  xiaomi: 'Xiaomi',
  stepfun: 'StepFun',
  cohere: 'Cohere',
  klingai: 'KlingAI',
  baidu: 'Baidu',
  lmsys: 'LMSYS',
  'luma-ai': 'Luma AI',
  recraft: 'Recraft',
  '01-ai': '01.AI',
  nexusflow: 'NexusFlow',
  reka: 'Reka',
  'hugging-face': 'Hugging Face',
  runway: 'Runway',
  databricks: 'Databricks',
  'shanghai-ai-lab': 'Shanghai AI Lab',
  ai21: 'AI21',
  'stability-ai': 'Stability AI',
  ideogram: 'Ideogram',
  'perplexity-ai': 'Perplexity AI',
  tii: 'TII',
  snowflake: 'Snowflake',
}

const ALIASES = {
  allenai: 'ai2',
  'allen-ai': 'ai2',
  ai2: 'ai2',
  '01ai': '01-ai',
  '01.ai': '01-ai',
  huggingface: 'hugging-face',
  'hugging-face': 'hugging-face',
  blackforestlabs: 'black-forest-labs',
  bfl: 'black-forest-labs',
  stabilityai: 'stability-ai',
  stability: 'stability-ai',
  zhipu: 'zai',
  'z-ai': 'zai',
  zhipuai: 'zai',
  thudm: 'zai',
  qwen: 'alibaba',
  'alibaba-cloud': 'alibaba',
  moonshotai: 'moonshot',
  kimi: 'moonshot',
  seed: 'bytedance',
  'step-fun': 'stepfun',
  kling: 'klingai',
  'kling-ai': 'klingai',
  luma: 'luma-ai',
  perplexity: 'perplexity-ai',
  recraftai: 'recraft',
  runwayml: 'runway',
  'x-ai': 'xai',
  'x.ai': 'xai',
}

const PREFIXES = [
  ['nemotron', 'nvidia'],
  ['granite', 'ibm'],
  ['phi-', 'microsoft'],
  ['wizardlm', 'microsoft'],
  ['chatglm', 'zai'],
  ['cogvlm', 'zai'],
  ['glm-', 'zai'],
  ['qwen', 'alibaba'],
  ['wan', 'alibaba'],
  ['flux', 'black-forest-labs'],
  ['claude', 'anthropic'],
  ['chatgpt', 'openai'],
  ['gpt-', 'openai'],
  ['dall-e', 'openai'],
  ['sora', 'openai'],
  ['o1', 'openai'],
  ['o3', 'openai'],
  ['o4', 'openai'],
  ['gemini', 'google'],
  ['gemma', 'google'],
  ['veo-', 'google'],
  ['imagen', 'google'],
  ['grok', 'xai'],
  ['deepseek', 'deepseek'],
  ['mixtral', 'mistral'],
  ['mistral', 'mistral'],
  ['pixtral', 'mistral'],
  ['command-', 'cohere'],
  ['amazon-nova', 'amazon'],
  ['nova-', 'amazon'],
  ['hunyuan', 'tencent'],
  ['kimi', 'moonshot'],
  ['hailuo', 'minimax'],
  ['minimax', 'minimax'],
  ['seedream', 'bytedance'],
  ['seedance', 'bytedance'],
  ['ernie', 'baidu'],
  ['kling', 'klingai'],
  ['yi-', '01-ai'],
  ['jamba', 'ai21'],
  ['reka-', 'reka'],
  ['athene-', 'nexusflow'],
  ['internlm', 'shanghai-ai-lab'],
  ['internvl', 'shanghai-ai-lab'],
  ['snowflake', 'snowflake'],
  ['dbrx', 'databricks'],
  ['vicuna', 'lmsys'],
  ['fastchat', 'lmsys'],
  ['tulu', 'ai2'],
  ['olmo', 'ai2'],
  ['molmo', 'ai2'],
  ['falcon', 'tii'],
  ['llama', 'meta'],
]

const COLORS = ['#c8783c', '#3ca0c8', '#e0a03c', '#d05ab4', '#7a5ae0', '#5a7ae0', '#5ab45a', '#e05a5a']

function num(value) {
  const n = typeof value === 'bigint' ? Number(value) : Number(value)
  return Number.isFinite(n) ? n : NaN
}

export function modelLabel(id) {
  return String(id).split('-').map((part) => {
    if (!part) return part
    if (/^o\d/i.test(part)) return part.toLowerCase()
    const lower = part.toLowerCase()
    if (ACRONYM.has(lower)) return lower.toUpperCase()
    if (/^[0-9]/.test(part)) return part
    return part.charAt(0).toUpperCase() + part.slice(1)
  }).join(' ')
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function vendorIdFor(org, modelName) {
  const fromOrg = ALIASES[slug(org)] || slug(org)
  if (fromOrg) return fromOrg
  const name = String(modelName || '').toLowerCase()
  for (const [prefix, id] of PREFIXES) {
    if (name.startsWith(prefix)) return id
  }
  return 'other'
}

function vendorMeta(id) {
  const avatar = AVATARS[id] || 'mystery'
  const color = avatar === 'mystery' ? colorFor(id) : ''
  const name = NAMES[id] || id.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join(' ')
  return { id, name, avatar, color }
}

function colorFor(id) {
  let hash = 0
  for (const ch of id) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

async function listLatestParquets(subset) {
  const url = `https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset/tree/main/${subset}`
  const payload = JSON.parse(await fetchText(url, { accept: 'application/json', timeout: 30000 }))
  const files = payload
    .filter((row) => row.type === 'file' && /\/latest-.*\.parquet$/.test(row.path))
    .map((row) => row.path)
  if (!files.length) throw new Error(`no latest parquet in ${subset}`)
  return files
}

/**
 * Download the public Arena leaderboard dataset (latest split only).
 * @returns {Promise<Record<string, { updated: string, rows: object[] }>>}
 */
export async function fetchLeaderboards(log) {
  const subsets = [...new Set(BOARDS.map((board) => board.subset))]
  const bySubset = new Map()
  for (const subset of subsets) {
    const files = await listLatestParquets(subset)
    const rows = []
    for (const file of files) {
      const url = `${DATASET}/resolve/main/${file}`
      log.info(`arena fetch ${file}`)
      const buffer = await fetchBuffer(url)
      if (buffer.length < 100) throw new Error(`short parquet ${file}`)
      const part = await parquetReadObjects({ file: asArrayBuffer(buffer), compressors })
      rows.push(...part)
    }
    const sane = rows.filter((row) => num(row.rating) > 100).length
    if (sane < rows.length * 0.8) throw new Error(`unexpected rating scale in ${subset}`)
    bySubset.set(subset, rows)
    log.info(`arena ${subset} rows=${rows.length}`)
  }

  const tables = {}
  for (const board of BOARDS) {
    const rows = bySubset.get(board.subset).filter((row) => row.category === board.category)
    if (rows.length < 3) {
      const cats = [...new Set(bySubset.get(board.subset).map((row) => row.category))].join(',')
      throw new Error(`board ${board.key} category ${board.category} has ${rows.length} rows (have: ${cats})`)
    }
    const dates = rows.map((row) => String(row.leaderboard_publish_date || '')).filter(Boolean)
    tables[board.key] = {
      updated: dates.sort().at(-1) || '',
      rows: rows.map((row) => ({
        model: String(row.model_name || '').trim(),
        org: String(row.organization || '').trim(),
        rating: num(row.rating),
        ratingLower: num(row.rating_lower),
        ratingUpper: num(row.rating_upper),
        votes: Math.max(0, Math.round(num(row.vote_count) || 0)),
        rank: Math.max(1, Math.round(num(row.rank) || 0)),
      })).filter((row) => row.model && Number.isFinite(row.rating)),
    }
  }
  return tables
}

function scoreOf(row) {
  const score = Math.round(row.rating)
  const ciDown = Math.max(0, Math.round(row.rating - row.ratingLower))
  const ciUp = Math.max(0, Math.round(row.ratingUpper - row.rating))
  return { score, ciUp: Number.isFinite(ciUp) ? ciUp : 0, ciDown: Number.isFinite(ciDown) ? ciDown : 0, votes: row.votes, preliminary: 0 }
}

/**
 * Pure builder. `tables` is the per-board row map from fetchLeaderboards.
 * `seen` is the previous seen.json or null.
 * `boardList` defaults to every Arena.ai board. A key with no entry in
 * lib/board-meta.mjs is omitted from the release and logged once as
 * `arena skip board=<key> reason=no-category`. The rest are published.
 * Zero mapped boards, or invalid metadata on a mapped board, throws before
 * a release exists so publish keeps yesterday's files.
 */
export function buildArenaRelease({ tables, seen, now = new Date(), boardList = BOARDS, log }) {
  const skipped = []
  const mappedBoards = []
  for (const board of boardList) {
    if (!hasArenaBoardMapping(board.key)) skipped.push(board.key)
    else mappedBoards.push(board)
  }
  for (const key of skipped) log?.info(`arena skip board=${key} reason=no-category`)
  for (const board of mappedBoards) arenaBoardMeta(board.key)
  if (!mappedBoards.length) {
    const detail = skipped.length ? `: ${skipped.join(', ')}` : ''
    throw new Error(`arena boards have no category mapping${detail}`)
  }
  const clock = shanghaiParts(now)
  const boardKeys = mappedBoards.map((board) => board.key)
  for (const key of boardKeys) {
    if (!tables[key]?.rows?.length) throw new Error(`missing board ${key}`)
  }

  const orgByModel = new Map()
  const textRows = tables.text.rows
  for (const row of textRows) {
    if (row.org) orgByModel.set(row.model, row.org)
  }
  for (const key of boardKeys) {
    for (const row of tables[key].rows) {
      if (row.org && !orgByModel.has(row.model)) orgByModel.set(row.model, row.org)
    }
  }

  const cells = {}
  for (const key of boardKeys) {
    const best = new Map()
    for (const row of tables[key].rows) {
      const prev = best.get(row.model)
      if (!prev || row.rank < prev.rank) best.set(row.model, row)
    }
    cells[key] = best
  }

  const modelIds = new Set()
  for (const key of boardKeys) {
    for (const id of cells[key].keys()) modelIds.add(id)
  }

  const vendorOf = new Map()
  for (const id of modelIds) vendorOf.set(id, vendorIdFor(orgByModel.get(id) || '', id))

  const prior = seen && seen.models && typeof seen.models === 'object' ? seen : null
  const seededAt = prior?.seededAt || clock.date
  const seenModels = { ...(prior?.models || {}) }
  const isNew = new Map()
  if (!prior) {
    for (const id of modelIds) {
      seenModels[id] = clock.date
      isNew.set(id, false)
    }
  } else {
    for (const id of modelIds) {
      if (!seenModels[id]) {
        seenModels[id] = clock.date
        isNew.set(id, true)
      } else {
        const fresh = seenModels[id] !== seededAt && daysBetween(seenModels[id], clock.date) <= 7 && daysBetween(seenModels[id], clock.date) >= 0
        isNew.set(id, fresh)
      }
    }
  }

  const ranks = {}
  const counts = {}
  for (const key of boardKeys) {
    const list = [...cells[key].values()].sort((a, b) => a.rank - b.rank || b.rating - a.rating)
    ranks[key] = new Map(list.map((row, index) => [row.model, index + 1]))
    counts[key] = list.length
  }

  const compOf = new Map()
  for (const id of modelIds) {
    const percentiles = []
    for (const key of boardKeys) {
      if (!cells[key].has(id)) continue
      const n = counts[key]
      const rank = ranks[key].get(id)
      percentiles.push(n <= 1 ? 100 : ((n - rank) / (n - 1)) * 100)
    }
    if (!percentiles.length) continue
    const mean = percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length
    compOf.set(id, Math.round(mean * 10) / 10)
  }

  const hot = []
  const perVendor = new Map()
  for (const row of [...textRows].sort((a, b) => a.rank - b.rank || b.rating - a.rating)) {
    const vendor = vendorOf.get(row.model) || 'other'
    const used = perVendor.get(vendor) || 0
    if (used >= 2) continue
    hot.push(row.model)
    perVendor.set(vendor, used + 1)
    if (hot.length >= 16) break
  }
  if (hot.length < 8) throw new Error(`hot pool has ${hot.length} models`)

  const hotSet = new Set(hot)
  const spanOf = {}
  for (const key of boardKeys) {
    const scores = hot.map((id) => cells[key].get(id)).filter(Boolean).map((row) => scoreOf(row).score)
    spanOf[key] = scores.length < 2 ? 30 : Math.max(30, Math.max(...scores) - Math.min(...scores))
  }

  const dayIndex = Math.floor(Date.parse(`${clock.date}T00:00:00+08:00`) / 86400000)
  const left = hot[dayIndex % hot.length]
  let right = hot[(dayIndex + 1) % hot.length]
  for (let step = 1; step < hot.length; step++) {
    const candidate = hot[(dayIndex + step) % hot.length]
    if (vendorOf.get(candidate) !== vendorOf.get(left)) {
      right = candidate
      break
    }
  }
  if (left === right) throw new Error('featured pair collapsed')

  const vendorCounts = new Map()
  for (const id of modelIds) {
    if (!compOf.has(id)) continue
    const vendor = vendorOf.get(id)
    vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1)
  }
  const vendorIds = [...vendorCounts.keys()].sort((a, b) => vendorCounts.get(b) - vendorCounts.get(a) || a.localeCompare(b))
  const vendorIndex = new Map(vendorIds.map((id, index) => [id, index]))
  const vendors = vendorIds.map((id) => {
    const meta = vendorMeta(id)
    return [meta.id, meta.name, meta.avatar, meta.color, vendorCounts.get(id)]
  })

  const orderedModels = [...modelIds].filter((id) => compOf.has(id)).sort((a, b) => compOf.get(b) - compOf.get(a) || a.localeCompare(b))
  const models = orderedModels.map((id) => {
    let mask = 0
    boardKeys.forEach((key, index) => {
      if (cells[key].has(id)) mask += 2 ** index
    })
    return [id, modelLabel(id), vendorIndex.get(vendorOf.get(id)), mask, compOf.get(id), isNew.get(id) ? 1 : 0]
  })

  const row5 = (key, id) => {
    const row = cells[key].get(id)
    if (!row) return null
    const scored = scoreOf(row)
    return [scored.score, scored.ciUp, scored.ciDown, scored.votes, scored.preliminary]
  }

  const inline = {}
  for (const id of [left, right]) {
    inline[id] = {}
    boardKeys.forEach((key, index) => {
      const row = row5(key, id)
      if (row) inline[id][String(index)] = row
    })
  }

  const vendorFiles = {}
  for (const vendor of vendorIds) {
    const file = {}
    for (const id of orderedModels) {
      if (vendorOf.get(id) !== vendor) continue
      const per = {}
      boardKeys.forEach((key, index) => {
        const row = row5(key, id)
        if (row) per[String(index)] = row
      })
      if (Object.keys(per).length) file[id] = per
    }
    vendorFiles[vendor] = file
  }

  const boards = mappedBoards.map((board) => {
    const voteSum = [...cells[board.key].values()].reduce((sum, row) => sum + row.votes, 0)
    return {
      k: board.key,
      url: board.url,
      upd: formatLeaderboardDate(tables[board.key].updated),
      tv: Math.round(voteSum / 2),
      at: clock.iso,
      span: spanOf[board.key],
      n: counts[board.key],
      ...arenaBoardMeta(board.key),
    }
  })

  const index = {
    v: 2,
    date: clock.date,
    updatedAt: clock.iso,
    source: SOURCE,
    method: {
      dataset: DATASET,
      comp: '综合分 = 该模型在其出现的各榜单中的百分位排名均值（0–100）',
      span: '伤害标尺 poolSpan = 热门池（文本总榜前 16，每家最多 2 个）在该榜的分差，至少 30',
      damage: '10 + 40 × |Δscore| / poolSpan，上限 50；Δ ≤ 区间和判格挡；Δ > 2×区间和为重击',
      preliminary: '公开数据集没有 preliminary 列，记 0',
      totalVotes: 'tv 为该榜各模型 vote_count 之和的一半，约等于对战场次',
    },
    boards,
    vendors,
    models,
    featured: { left, right, reason: 'rotation' },
    inline,
  }

  const latestModels = {}
  for (const id of hot) {
    const vendor = vendors[vendorIndex.get(vendorOf.get(id))]
    const boardsForModel = boardKeys.filter((key) => cells[key].has(id) && hotSet.has(id))
    latestModels[id] = {
      id,
      label: modelLabel(id),
      avatar: vendor[2],
      vendor: vendor[0],
      comp: compOf.get(id),
      isNew: Boolean(isNew.get(id)),
      boards: boardsForModel,
    }
  }
  const latestBoards = mappedBoards.map((board) => ({
    key: board.key,
    source: SOURCE,
    url: board.url,
    leaderboardUpdated: formatLeaderboardDate(tables[board.key].updated),
    totalVotes: boards.find((item) => item.k === board.key).tv,
    fetchedAt: clock.iso,
    poolSpan: spanOf[board.key],
    ...arenaBoardMeta(board.key),
    models: Object.fromEntries(hot.filter((id) => cells[board.key].has(id)).map((id) => {
      const scored = scoreOf(cells[board.key].get(id))
      return [id, { score: scored.score, ciUp: scored.ciUp, ciDown: scored.ciDown, votes: scored.votes, preliminary: false }]
    })),
  }))

  const latest = {
    version: 1,
    date: clock.date,
    updatedAt: clock.iso,
    featured: { left, right, reason: 'rotation' },
    models: latestModels,
    boards: latestBoards,
  }

  return {
    index,
    latest,
    vendorFiles,
    seen: { seededAt, models: seenModels },
    date: clock.date,
  }
}

export function assertArenaRelease(release) {
  const { index, latest, vendorFiles } = release
  if (index.v !== 2) throw new Error('arena index v')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(index.date)) throw new Error('arena date')
  if (!index.updatedAt) throw new Error('arena updatedAt')
  if (!Array.isArray(index.boards) || !index.boards.length) throw new Error('arena boards')
  if (!Array.isArray(index.vendors) || !index.vendors.length) throw new Error('arena vendors')
  if (!Array.isArray(index.models) || index.models.length < 4) throw new Error('arena models')
  if (!index.models.some((row) => row[0] === index.featured.left)) throw new Error('featured left missing')
  if (!index.models.some((row) => row[0] === index.featured.right)) throw new Error('featured right missing')
  if (index.featured.left === index.featured.right) throw new Error('featured pair')
  const catalog = BOARDS.map((board) => board.key)
  let lastCatalogIndex = -1
  for (const board of index.boards) {
    const at = catalog.indexOf(board.k)
    if (at <= lastCatalogIndex) throw new Error(`arena board order ${board.k}`)
    lastCatalogIndex = at
    if (!(board.span >= 30)) throw new Error(`poolSpan ${board.k}`)
    if (!(board.n >= 3)) throw new Error(`count ${board.k}`)
    assertArenaBoardFields(board, board.k)
  }
  for (const id of [index.featured.left, index.featured.right]) {
    const rows = index.inline[id]
    if (!rows || !Object.keys(rows).length) throw new Error(`inline ${id}`)
    for (const row of Object.values(rows)) {
      if (!Array.isArray(row) || row.length !== 5) throw new Error(`inline row ${id}`)
      if (row[0] < 800 || row[0] > 2200) throw new Error(`score scale ${id}`)
    }
  }
  for (const [id, , vendorIndex] of index.models) {
    const vendor = index.vendors[vendorIndex]
    if (!vendor) throw new Error(`vendor index ${id}`)
    const file = vendorFiles[vendor[0]]
    if (!file?.[id]) throw new Error(`vendor file missing ${vendor[0]}/${id}`)
  }
  if (!latest.models[latest.featured.left] || !latest.models[latest.featured.right]) {
    throw new Error('latest featured missing')
  }
  if (!Array.isArray(latest.boards) || latest.boards.length !== index.boards.length || !latest.models) {
    throw new Error('latest shape')
  }
  for (let i = 0; i < index.boards.length; i++) {
    const indexBoard = index.boards[i]
    const latestBoard = latest.boards[i]
    if (latestBoard?.key !== indexBoard.k) throw new Error(`latest board order ${latestBoard?.key}`)
    assertArenaBoardFields(latestBoard, indexBoard.k)
  }
  const text = latest.boards.find((board) => board.key === 'text')
  const pair = text?.models?.[latest.featured.left] && text?.models?.[latest.featured.right]
  if (!pair) throw new Error('featured pair has no text scores')
  return release
}

/** Keep every previously seen model. A missing file is a first run; a broken file is an error. */
export async function loadSeen(dir) {
  const file = path.join(dir, 'arena-data', 'seen.json')
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw new Error(`arena seen.json cannot be read: ${error.message}`)
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('arena seen.json is unreadable; refusing to replace it')
  }
  if (!raw || typeof raw.models !== 'object' || raw.models === null || Array.isArray(raw.models)) {
    throw new Error('arena seen.json is unreadable; refusing to replace it')
  }
  return raw
}

/** Union of on-disk history and this run. Existing ids and seededAt stay. */
export function mergeSeen(prior, next) {
  if (!prior) return next
  const models = { ...prior.models }
  for (const [id, day] of Object.entries(next?.models || {})) {
    if (typeof models[id] !== 'string' && typeof day === 'string') models[id] = day
  }
  return {
    seededAt: typeof prior.seededAt === 'string' && prior.seededAt ? prior.seededAt : next.seededAt,
    models,
  }
}

export async function publishArena(dir, release) {
  assertArenaRelease(release)
  const seen = mergeSeen(await loadSeen(dir), release.seen)
  const date = release.date
  await writeJsonAtomic(dir, 'arena-data/index.json', release.index)
  await writeJsonAtomic(dir, `arena-data/index-${date}.json`, release.index)
  await writeJsonAtomic(dir, 'arena-data/latest.json', release.latest)
  await writeJsonAtomic(dir, `arena-data/${date}.json`, release.latest)
  for (const [vendor, file] of Object.entries(release.vendorFiles)) {
    await writeJsonAtomic(dir, `arena-data/v/${vendor}.json`, file)
  }
  await writeJsonAtomic(dir, 'arena-data/seen.json', seen)
}

export async function runArena({ dir, log }) {
  const tables = await fetchLeaderboards(log)
  if (tables.text.rows.length < 30) throw new Error(`text board too small: ${tables.text.rows.length}`)
  const seen = await loadSeen(dir)
  const release = buildArenaRelease({ tables, seen, log })
  assertArenaRelease(release)
  await publishArena(dir, release)
  log.info(`arena published date=${release.date} models=${release.index.models.length} featured=${release.index.featured.left} vs ${release.index.featured.right} updatedAt=${release.index.updatedAt}`)
  return release
}
