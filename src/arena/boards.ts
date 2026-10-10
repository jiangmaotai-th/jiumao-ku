/**
 * 榜单元数据校验 + 把两位模型的共同榜单转成 RoundInput（纯函数，不碰 DOM / 网络）。
 * 依据 docs/design/arena-battle.md 第 4 节、10.6 第 8 条：
 * 缺 unit / higherIsBetter / category 或类型不对的榜 → 不出招、不生成回合；
 * 原因由调用方决定怎么记（前端只在开发环境控制台打印）。
 */
import type { Category, RoundInput, Unit } from './rules'

export const SCORED_CATEGORIES = ['arena', 'code', 'math', 'knowledge', 'index'] as const
export type ScoredCategory = (typeof SCORED_CATEGORIES)[number]
const UNITS: readonly Unit[] = ['elo', 'percent', 'index']
export type BoardCategory = ScoredCategory | 'pelican'
/** 规范值沿用 rules.ts；文档 6.1 的 `coding` / `showcase` 只作别名收（规范名待天宏定） */
const CATEGORY_ALIAS: Record<string, BoardCategory> = { arena: 'arena', code: 'code', coding: 'code', math: 'math', knowledge: 'knowledge', index: 'index', pelican: 'pelican', showcase: 'pelican' }

export interface BoardMeta { unit: Unit; higherIsBetter: boolean; category: BoardCategory }
export type BoardCheck = { ok: true; meta: BoardMeta } | { ok: false; reason: string }

export function checkBoardMeta(b: { unit?: unknown; higherIsBetter?: unknown; category?: unknown }): BoardCheck {
  const missing: string[] = []
  if (typeof b.unit !== 'string' || !UNITS.includes(b.unit as Unit)) missing.push(`unit=${JSON.stringify(b.unit)}`)
  if (typeof b.higherIsBetter !== 'boolean') missing.push(`higherIsBetter=${JSON.stringify(b.higherIsBetter)}`)
  const cat = typeof b.category === 'string' && Object.hasOwn(CATEGORY_ALIAS, b.category) ? CATEGORY_ALIAS[b.category] : undefined
  if (!cat) missing.push(`category=${JSON.stringify(b.category)}`)
  if (missing.length) return { ok: false, reason: `缺字段或类型不对：${missing.join(', ')}` }
  return { ok: true, meta: { unit: b.unit as Unit, higherIsBetter: b.higherIsBetter as boolean, category: cat as BoardCategory } }
}

export interface BoardScore { score: number; ciUp?: number; ciDown?: number }
export interface BoardLike {
  key: string
  poolSpan: number
  unit?: unknown
  higherIsBetter?: unknown
  category?: unknown
  models: Record<string, BoardScore | undefined>
}
export interface SkippedBoard { key: string; reason: string }
export interface MatchInputs {
  inputs: RoundInput[]
  /** 五个计分类别里一条可同台榜单都没有的 → 灰槽「无共同数据」 */
  noShared: ScoredCategory[]
  skipped: SkippedBoard[]
}

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** 按榜单原顺序生成双方都有成绩、元数据合格的回合输入；回合号由 resolveBattle 按数组顺序连续编号。 */
export function buildMatchInputs(boards: readonly BoardLike[], idA: string, idB: string): MatchInputs {
  const inputs: RoundInput[] = []
  const skipped: SkippedBoard[] = []
  const played = new Set<BoardCategory>()
  for (const b of boards) {
    const a = b.models[idA]
    const c = b.models[idB]
    if (!a || !c) continue // 缺一方：第 4 节，静默不出招
    const chk = checkBoardMeta(b)
    if (!chk.ok) { skipped.push({ key: b.key, reason: chk.reason }); continue }
    if (!num(a.score) || !num(c.score)) { skipped.push({ key: b.key, reason: '分数不是数字' }); continue }
    if (!(num(b.poolSpan) && b.poolSpan > 0)) { skipped.push({ key: b.key, reason: 'poolSpan 必须 > 0' }); continue }
    played.add(chk.meta.category)
    inputs.push({
      category: chk.meta.category as Category,
      a: { score: a.score, ciUp: a.ciUp, ciDown: a.ciDown },
      b: { score: c.score, ciUp: c.ciUp, ciDown: c.ciDown },
      normSpan: b.poolSpan,
      higherIsBetter: chk.meta.higherIsBetter,
      benchmarkId: b.key,
      unit: chk.meta.unit,
    })
  }
  return { inputs, noShared: SCORED_CATEGORIES.filter((k) => !played.has(k)), skipped }
}
