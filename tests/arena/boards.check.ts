import assert from 'node:assert/strict'
import { checkBoardMeta, buildMatchInputs } from '../../src/arena/boards.ts'
import { resolveBattle } from '../../src/arena/rules.ts'

// 元数据校验
assert.equal(checkBoardMeta({ unit: 'elo', higherIsBetter: true, category: 'arena' }).ok, true)
assert.equal(checkBoardMeta({ unit: 'percent', higherIsBetter: false, category: 'coding' }).ok, true) // 6.1 别名
for (const bad of [{}, { unit: 'elo', higherIsBetter: 'true', category: 'arena' }, { unit: 'Elo', higherIsBetter: true, category: 'arena' },
  { unit: 'elo', higherIsBetter: true, category: 'pelican' }, { unit: 1, higherIsBetter: true, category: 'math' }]) {
  const r = checkBoardMeta(bad); assert.equal(r.ok, false); if (!r.ok) assert.ok(r.reason.length > 0)
}

const meta = (category: string, unit = 'percent', higherIsBetter: unknown = true) => ({ category, unit, higherIsBetter })
const boards = [
  { key: 'lmarena', poolSpan: 120, ...meta('arena', 'elo'), models: { A: { score: 1310, ciUp: 5, ciDown: 5 }, B: { score: 1288, ciUp: 5, ciDown: 5 } } },
  { key: 'swe', poolSpan: 30, models: { A: { score: 72 }, B: { score: 58 } } }, // 缺元数据 → 跳过
  { key: 'onlyA', poolSpan: 30, ...meta('math'), models: { A: { score: 90 } } }, // 缺一方 → 静默不出招
  { key: 'gpqa', poolSpan: 20, ...meta('knowledge'), models: { A: { score: 88 }, B: { score: 92 } } },
  { key: 'hle-err', poolSpan: 20, ...meta('knowledge', 'percent', false), models: { A: { score: 10 }, B: { score: 20 } } },
  { key: 'bad-hib', poolSpan: 20, ...meta('index', 'index', 'yes'), models: { A: { score: 1 }, B: { score: 2 } } },
]
const m = buildMatchInputs(boards, 'A', 'B')
assert.deepEqual(m.inputs.map((x) => x.benchmarkId), ['lmarena', 'gpqa', 'hle-err'])
assert.deepEqual(m.skipped.map((x) => x.key), ['swe', 'bad-hib'])
assert.deepEqual(m.noShared, ['code', 'math', 'index'])

// BattleRound 透传字段 + 回合号连续不断号（10.6 第 1、2、8 条）
const b = resolveBattle(m.inputs)
assert.deepEqual(b.rounds.map((r) => r.round), [1, 2, 3])
const r0 = b.rounds[0]
assert.equal(r0.benchmarkId, 'lmarena'); assert.equal(r0.category, 'arena'); assert.equal(r0.unit, 'elo')
assert.equal(r0.scoreA, 1310); assert.equal(r0.scoreB, 1288); assert.equal(r0.higherIsBetter, true)
assert.equal(b.rounds[2].higherIsBetter, false); assert.equal(b.rounds[2].winner, 'a')
assert.equal(b.koRound, null); assert.ok(b.rounds.every((r) => !r.koHere))

// K.O. 回合号：applied 等于剩余血量，之后 afterKo
const crush = { category: 'code' as const, a: { score: 100 }, b: { score: 0 }, normSpan: 10 }
const k = resolveBattle([crush, crush, crush, crush, crush, crush, crush])
assert.equal(k.koRound, 5)
assert.deepEqual(k.rounds.map((r) => r.koHere), [false, false, false, false, true, false, false])
assert.equal(k.rounds[4].applied, 100 - 22 * 4)
assert.ok(k.rounds.slice(5).every((r) => r.afterKo && r.applied === 0))
// 没给 benchmarkId / unit 时为 null（不编造）
assert.equal(k.rounds[0].benchmarkId, null); assert.equal(k.rounds[0].unit, null)
console.log('arena boards: ok')
