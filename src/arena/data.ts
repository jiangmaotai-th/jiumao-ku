import { buildMatchInputs, type MatchInputs } from './boards'
import type { ArenaBoard, ArenaData, ArenaModel, ArenaVendor, Avatar } from './types'
import { arenaMessages, type ArenaMessages } from '../i18n/arena'
import { getLocale } from '../i18n'

export const ARENA_PATH = '/arena/'
export const ARENA_DATA_URL = '/arena-data/latest.json'
export const ARENA_INDEX_URL = '/arena-data/index.json'

export function arenaCopy(): ArenaMessages {
  return arenaMessages[getLocale()] ?? arenaMessages.en
}

type IndexJson = {
  v: 2
  date: string
  updatedAt: string
  source: string
  boards: { k: string; url: string; upd: string | null; tv: number | null; at: string; span: number; n: number; unit?: string; higherIsBetter?: boolean; category?: string }[]
  vendors: [string, string, string, string, number][]
  models: [string, string, number, number, number, number][]
  featured: { left: string; right: string; reason?: string }
  inline: Record<string, Record<string, Row5>>
}
type Row5 = [number, number, number, number, number]

let pending: Promise<ArenaData | null> | null = null
const loadedVendors = new Set<string>()

function putRows(d: ArenaData, rows: Record<string, Record<string, Row5>>) {
  for (const [id, per] of Object.entries(rows)) {
    for (const [bi, r] of Object.entries(per)) {
      const b = d.boards[Number(bi)]
      if (b) b.models[id] = { score: r[0], ciUp: r[1], ciDown: r[2], votes: r[3], preliminary: !!r[4] }
    }
  }
}

function fromIndex(j: IndexJson): ArenaData {
  const boards: ArenaBoard[] = j.boards.map((b) => ({ key: b.k, source: j.source, url: b.url, leaderboardUpdated: b.upd, totalVotes: b.tv, fetchedAt: b.at, poolSpan: b.span, unit: b.unit, higherIsBetter: b.higherIsBetter, category: b.category, models: {} }))
  const vendors: Record<string, ArenaVendor> = {}
  for (const [id, name, avatar, color, count] of j.vendors) vendors[id] = { id, name, avatar: avatar as Avatar, color, count }
  const models: Record<string, ArenaModel> = {}
  for (const [id, label, vi, mask, comp, flags] of j.models) {
    const v = j.vendors[vi]
    models[id] = { id, label, avatar: v[2] as Avatar, vendor: v[0], comp, isNew: !!(flags & 1), boards: boards.filter((_, i) => mask & (1 << i)).map((b) => b.key) }
  }
  const d: ArenaData = { version: 2, date: j.date, updatedAt: j.updatedAt, featured: j.featured, models, boards, vendors }
  putRows(d, j.inline)
  return d
}

/** index.json (v2, small) first; falls back to the legacy latest.json. */
export function loadArenaData(): Promise<ArenaData | null> {
  pending ??= fetch(ARENA_INDEX_URL, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<IndexJson>) : null))
    .then((j) => (j && j.v === 2 ? fromIndex(j) : null))
    .catch(() => null)
    .then((d) => d ?? fetch(ARENA_DATA_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<ArenaData>) : null))
      .then((x) => (x && Array.isArray(x.boards) && x.models ? x : null))
      .catch(() => null))
  return pending
}

/** fetch per-lab detail files so both models have every board row */
export async function ensureModels(d: ArenaData, ids: string[]): Promise<boolean> {
  if (d.version !== 2) return true
  const need = [...new Set(ids.map((id) => d.models[id]?.vendor).filter((v): v is string => !!v && !loadedVendors.has(v)))]
  // skip labs whose models are already complete (inline featured pair)
  const todo = need.filter((v) => ids.some((id) => d.models[id]?.vendor === v && d.models[id].boards.some((k) => !d.boards.find((b) => b.key === k)?.models[id])))
  try {
    await Promise.all(todo.map((v) => fetch(`/arena-data/v/${encodeURIComponent(v)}.json`).then((r) => r.json()).then((rows) => { putRows(d, rows); loadedVendors.add(v) })))
    return true
  } catch { return false }
}

/** sprite/tint key for the engine: mystery challengers wear their lab colour */
export function avatarKey(d: ArenaData, m: ArenaModel): string {
  const v = m.vendor ? d.vendors?.[m.vendor] : undefined
  return m.avatar === 'mystery' && v?.color ? `mystery${v.color}` : m.avatar
}

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
}

/** Rail link (homepage, /ai/, /arena/). */
export function renderArenaRailItem(active = false): string {
  const label = arenaCopy().rail
  return `<a class="app-rail__item app-rail__item--arena${active ? ' is-active' : ''}" href="${localized()}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span>${escapeHtml(label)}</span></a>`
}

function localized(): string {
  // late import avoids a cycle with ../i18n in SSR meta generation
  const slug = location.pathname.split('/')[1]
  const known = ['zh-cn', 'zh-tw', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'hi', 'th', 'ru', 'pt']
  return known.includes(slug) ? `/${slug}${ARENA_PATH}` : `/zh-cn${ARENA_PATH}`
}

/**
 * Homepage: playable arena window (replaces the old banner). Only a sized
 * placeholder is added up-front; the engine chunk loads when the window is
 * near the viewport and the browser is idle, so the first paint is untouched.
 */
export function mountArenaPromo(before: HTMLElement | null) {
  // the AI boards may already sit inside a 2-column pair wrapper: go above it
  before = before?.closest<HTMLElement>('.ai-top') ?? before
  if (!before?.parentElement) return
  const host = document.createElement('section')
  host.className = 'arena-embed'
  host.setAttribute('aria-label', arenaCopy().title)
  host.innerHTML = `<div class="arena-embed__ph"><span>${escapeHtml(arenaCopy().kicker)}</span></div>`
  before.parentElement.insertBefore(host, before)
  let started = false
  const go = () => {
    if (started) return
    started = true
    const run = () => void import('./widget').then((m) => m.mountArena(host, { embed: true, fullHref: localized() }))
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
    if (ric) ric(run, { timeout: 1500 }); else setTimeout(run, 200)
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go() } }, { rootMargin: '300px' })
    io.observe(host)
  } else go()
}

export { localized as arenaHref }

/** 两位模型的回合输入；元数据不合格的榜跳过，原因只在开发环境控制台打印（10.6 第 8 条）。 */
export function matchInputs(d: ArenaData, leftId: string, rightId: string): MatchInputs {
  const m = buildMatchInputs(d.boards, leftId, rightId)
  if (import.meta.env.DEV) for (const s of m.skipped) console.warn(`[arena] 跳过榜单 ${s.key}：${s.reason}`)
  return m
}
