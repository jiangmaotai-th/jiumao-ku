import type { ArenaData, BattleResult, RoundResult, Side } from './types'

export const START_HP = 100

/**
 * Deterministic: same data → same battle. Only real leaderboard numbers feed
 * this; cheering never reaches here.
 */
export function computeBattle(data: ArenaData, leftId: string, rightId: string): BattleResult | null {
  const left = data.models[leftId]
  const right = data.models[rightId]
  if (!left || !right || leftId === rightId) return null
  const hp = { left: START_HP, right: START_HP }
  const rounds: RoundResult[] = []
  for (const board of data.boards) {
    const l = board.models[leftId]
    const r = board.models[rightId]
    if (!l || !r) continue // missing data → this round does not happen
    const attacker: Side = l.score >= r.score ? 'left' : 'right'
    const hi = attacker === 'left' ? l : r
    const lo = attacker === 'left' ? r : l
    const delta = hi.score - lo.score
    const threshold = hi.ciDown + lo.ciUp
    let kind: RoundResult['kind'] = 'hit'
    let damage = 0
    if (delta <= threshold) kind = 'block'
    else {
      damage = Math.min(50, Math.round(10 + (40 * delta) / Math.max(board.poolSpan, 1)))
      if (delta > 2 * threshold) kind = 'crit'
    }
    const target: Side = attacker === 'left' ? 'right' : 'left'
    const counter = damage > 0 && hp[attacker] < hp[target]
    hp[target] = Math.max(0, hp[target] - damage)
    rounds.push({ board, left: l, right: r, attacker, delta, threshold, kind, damage, counter, hpAfter: { ...hp } })
    if (hp[target] === 0) break
  }
  if (!rounds.length) return null
  const winner: Side | null = hp.left === hp.right ? null : hp.left > hp.right ? 'left' : 'right'
  return { left, right, rounds, winner }
}

/**
 * Pre-fight prediction (display only): mean Bradley–Terry / Elo expected score
 * of the left model over the boards both sides appear on.
 * E = 1 / (1 + 10^((R_right − R_left)/400)).
 */
export function predictLeft(b: BattleResult): number {
  const ps = b.rounds.map((r) => 1 / (1 + 10 ** ((r.right.score - r.left.score) / 400)))
  return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : 0.5
}
