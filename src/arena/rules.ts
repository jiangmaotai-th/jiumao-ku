/**
 * 竞技场「真实数据对决」裁判规则（纯函数，不碰画面和动画）。
 * 规则来源：docs/design/arena-battle.md 第 3、4、10 节，以及 2026-10-10 群内定稿：
 * - 完全按真实数据：无残血保护、无护盾、格挡伤害为 0（无震伤）。
 * - K.O. 后剩余回合照打，只记回合胜负，不再扣血。
 * - 胜负按 HP：先 K.O. 者输；否则 HP 高者胜；HP 相同为平局（不再比回合胜场）。
 * - 时长：开场 6s + 结算 8s + 计分回合平分 46s（每回合 6.5–9s）；鹈鹕展示回合另加 6.5s。总时长只许多不许少。
 */

export type Category = 'arena' | 'code' | 'math' | 'knowledge' | 'index' | 'pelican'

export const CATEGORY_WEIGHT: Record<Category, number> = {
  arena: 1.0,
  code: 1.2,
  math: 0.8,
  knowledge: 1.0,
  index: 1.0,
  pelican: 0,
}

/** 分数单位（arena-battle.md 6.1）。 */
export type Unit = 'elo' | 'percent' | 'index'

export const HP_MAX = 100
export const DAMAGE_CAP = 22
/** 共同跑分不足 6 项不开战：由选人逻辑（scripts/daily）和自选对决入口判断，本文件不使用，只作为共享常量。 */
export const MIN_SCORED_ROUNDS = 6

export interface SideScore {
  score: number
  /** 95% 置信区间向上 / 向下的宽度（没有就不填） */
  ciUp?: number
  ciDown?: number
}

export interface RoundInput {
  category: Category
  a: SideScore
  b: SideScore
  /** 归一跨度 D_b（数据里的 norm_span），> 0 */
  normSpan: number
  /** 越低越好的榜单设为 false，默认 true */
  higherIsBetter?: boolean
  /** 测试项目 id（6.1 的 benchmark_id）；回合记录用来取显示名 */
  benchmarkId?: string
  /** 分数单位；回合记录显示用，不参与计算 */
  unit?: Unit
}

export interface RoundResult {
  /** 这一回合谁占优；格挡或完全相等时为 null */
  winner: 'a' | 'b' | null
  blocked: boolean
  crit: boolean
  /** 归一差距 g，[0,1] */
  gap: number
  /** 按规则算出的伤害（理论值，不管是否已 K.O.） */
  damage: number
  /** 是否只演出、不计分（鹈鹕） */
  showcase: boolean
}

export function resolveRound(r: RoundInput): RoundResult {
  const w = CATEGORY_WEIGHT[r.category]
  if (w === 0) return { winner: null, blocked: false, crit: false, gap: 0, damage: 0, showcase: true }
  if (!(r.normSpan > 0)) throw new Error('normSpan must be > 0')
  const sign = r.higherIsBetter === false ? -1 : 1
  const diff = sign * (r.a.score - r.b.score)
  const delta = Math.abs(diff)
  const gap = Math.min(1, delta / r.normSpan)
  if (delta === 0) return { winner: null, blocked: true, crit: false, gap: 0, damage: 0, showcase: false }
  // 置信区间按“原始分数”的高低取：原始分高的一方取下边距，原始分低的一方取上边距。
  // 和榜单方向无关（越低越好的榜单里，占优的是原始分低的一方，用它的上边距）。
  const rawAHigher = r.a.score > r.b.score
  const hi = rawAHigher ? r.a : r.b
  const lo = rawAHigher ? r.b : r.a
  const hasCi = hi.ciDown != null && lo.ciUp != null
  const threshold = hasCi ? (hi.ciDown as number) + (lo.ciUp as number) : null
  const blocked = threshold != null ? delta <= threshold : gap < 0.05
  const winner = diff > 0 ? 'a' : 'b'
  if (blocked) return { winner: null, blocked: true, crit: false, gap, damage: 0, showcase: false }
  const damage = Math.min(DAMAGE_CAP, Math.round(w * (6 + 40 * gap)))
  const crit = (threshold != null && delta > 2 * threshold) || gap >= 0.4
  return { winner, blocked: false, crit, gap, damage, showcase: false }
}

export interface BattleRound extends RoundResult {
  /** 本回合实际扣掉的血（补刀时不超过对方剩余血量；K.O. 后为 0）。画面上的伤害数字显示这个值。 */
  applied: number
  hpA: number
  hpB: number
  /** 本回合开始时是否已有一方 K.O. */
  afterKo: boolean
  /** 回合号，从 1 起，等于出场顺序（第 10.5 节第 1 条） */
  round: number
  /** 以下透传自 RoundInput，回合记录只读这里，不另算（10.5 第 2、3 条） */
  category: Category
  benchmarkId: string | null
  scoreA: number
  scoreB: number
  higherIsBetter: boolean
  unit: Unit | null
  /** 本回合打出 K.O.（终结技），10.5 第 5 条 */
  koHere: boolean
}

export interface BattleResult {
  rounds: BattleRound[]
  hpA: number
  hpB: number
  ko: 'a' | 'b' | null
  /** K.O. 发生的回合号（BattleRound.round），没有 K.O. 为 null */
  koRound: number | null
  outcome: 'a' | 'b' | 'draw'
  decidedBy: 'ko' | 'hp' | 'draw'
  roundWinsA: number
  roundWinsB: number
  /** 赢家回合胜场比输家少时为 true（结算页显示说明句） */
  showUnderdogNote: boolean
}

export function resolveBattle(inputs: RoundInput[]): BattleResult {
  let hpA = HP_MAX
  let hpB = HP_MAX
  let ko: 'a' | 'b' | null = null
  let roundWinsA = 0
  let roundWinsB = 0
  let koRound: number | null = null
  const rounds: BattleRound[] = inputs.map((inp, i) => {
    const res = resolveRound(inp)
    const afterKo = ko !== null
    let applied = 0
    if (res.winner === 'a') roundWinsA++
    if (res.winner === 'b') roundWinsB++
    if (!afterKo && res.winner) {
      // applied = 实际扣掉的血；补刀时不超过对方剩余血量
      if (res.winner === 'a') { applied = Math.min(res.damage, hpB); hpB -= applied; if (hpB === 0) ko = 'b' }
      else { applied = Math.min(res.damage, hpA); hpA -= applied; if (hpA === 0) ko = 'a' }
    }
    const koHere = !afterKo && ko !== null
    if (koHere) koRound = i + 1
    return {
      ...res, applied, hpA, hpB, afterKo, round: i + 1, koHere,
      category: inp.category, benchmarkId: inp.benchmarkId ?? null,
      scoreA: inp.a.score, scoreB: inp.b.score,
      higherIsBetter: inp.higherIsBetter !== false, unit: inp.unit ?? null,
    }
  })
  let outcome: 'a' | 'b' | 'draw'
  let decidedBy: 'ko' | 'hp' | 'draw'
  if (ko) { outcome = ko === 'a' ? 'b' : 'a'; decidedBy = 'ko' }
  else if (hpA !== hpB) { outcome = hpA > hpB ? 'a' : 'b'; decidedBy = 'hp' }
  else { outcome = 'draw'; decidedBy = 'draw' }
  const showUnderdogNote = outcome === 'a' ? roundWinsA < roundWinsB : outcome === 'b' ? roundWinsB < roundWinsA : false
  return { rounds, hpA, hpB, ko, koRound, outcome, decidedBy, roundWinsA, roundWinsB, showUnderdogNote }
}

/** 时长（秒）。只许多不许少：每回合时长向上取到 0.01s。 */
export const INTRO_S = 6
export const OUTRO_S = 8
export const ROUNDS_BUDGET_S = 46
export const ROUND_MIN_S = 6.5
export const ROUND_MAX_S = 9
export const SHOWCASE_S = 6.5

export function roundDuration(scoredRounds: number): number {
  if (scoredRounds <= 0) return ROUND_MIN_S
  const raw = Math.max(ROUND_MIN_S, Math.min(ROUND_MAX_S, ROUNDS_BUDGET_S / scoredRounds))
  return Math.ceil(raw * 100) / 100
}

export function battleDuration(scoredRounds: number, showcaseRounds = 0): number {
  return INTRO_S + scoredRounds * roundDuration(scoredRounds) + showcaseRounds * SHOWCASE_S + OUTRO_S
}

/** 首页预览：理论伤害最高的计分回合；并列取靠前；全格挡取第一个计分回合。返回下标，没有计分回合返回 -1。 */
export function pickPreviewRound(rounds: RoundResult[]): number {
  let best = -1
  for (let i = 0; i < rounds.length; i++) {
    if (rounds[i].showcase) continue
    if (best === -1 || rounds[i].damage > rounds[best].damage) best = i
  }
  return best
}
