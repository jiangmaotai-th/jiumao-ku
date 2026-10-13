import assert from 'node:assert/strict'
import { SCORED_CATEGORIES, checkBoardMeta, buildMatchInputs } from '../../src/arena/boards.ts'
import { CATEGORY_WEIGHT, resolveBattle, resolveRound } from '../../src/arena/rules.ts'
import { arenaMessages } from '../../src/i18n/arena.ts'

// 元数据校验
assert.equal(checkBoardMeta({ unit: 'elo', higherIsBetter: true, category: 'arena' }).ok, true)
for (const [raw, want] of [['coding', 'code'], ['showcase', 'pelican'], ['pelican', 'pelican']]) {
  const r = checkBoardMeta({ unit: 'percent', higherIsBetter: false, category: raw }); assert.ok(r.ok && r.meta.category === want)
}
for (const cat of ['creative', 'vision']) {
  const r = checkBoardMeta({ unit: 'elo', higherIsBetter: true, category: cat })
  assert.ok(r.ok && r.meta.category === cat && r.meta.unit === 'elo' && r.meta.higherIsBetter === true)
}
assert.equal(checkBoardMeta({ unit: 'elo', higherIsBetter: true, category: 'creative-writing' }).ok, false)
for (const bad of [{}, { unit: 'elo', higherIsBetter: 'true', category: 'arena' }, { unit: 'Elo', higherIsBetter: true, category: 'arena' },
  { unit: 'elo', higherIsBetter: true, category: 'Coding' }, { unit: 'elo', higherIsBetter: true, category: 'toString' }, { unit: 1, higherIsBetter: true, category: 'math' }]) {
  const r = checkBoardMeta(bad); assert.equal(r.ok, false); if (!r.ok) assert.ok(r.reason.length > 0)
}

const meta = (category: string, unit = 'percent', higherIsBetter: unknown = true) => ({ category, unit, higherIsBetter })
const boards = [
  { key: 'lmarena', poolSpan: 120, ...meta('arena', 'elo'), models: { A: { score: 1310, ciUp: 5, ciDown: 5 }, B: { score: 1288, ciUp: 5, ciDown: 5 } } },
  { key: 'swe', poolSpan: 30, models: { A: { score: 72 }, B: { score: 58 } } }, // 缺元数据 → 跳过
  { key: 'onlyA', poolSpan: 30, ...meta('math'), models: { A: { score: 90 } } }, // 缺一方 → 静默不出招
  { key: 'gpqa', poolSpan: 20, ...meta('knowledge'), models: { A: { score: 88 }, B: { score: 92 } } },
  { key: 'hle-err', poolSpan: 20, ...meta('knowledge', 'percent', false), models: { A: { score: 10 }, B: { score: 20 } } },
  { key: 'creative-writing', poolSpan: 100, ...meta('creative', 'elo'), models: { A: { score: 80 }, B: { score: 60 } } },
  { key: 'vision', poolSpan: 100, ...meta('vision', 'elo'), models: { A: { score: 80 }, B: { score: 60 } } },
  { key: 'bad-hib', poolSpan: 20, ...meta('index', 'index', 'yes'), models: { A: { score: 1 }, B: { score: 2 } } },
]
const m = buildMatchInputs(boards, 'A', 'B')
assert.deepEqual(m.inputs.map((x) => x.benchmarkId), ['lmarena', 'gpqa', 'hle-err', 'creative-writing', 'vision'])
assert.deepEqual(m.skipped.map((x) => x.key), ['swe', 'bad-hib'])
assert.deepEqual(m.noShared, ['math', 'code', 'index'])
assert.equal(CATEGORY_WEIGHT.creative, 1)
assert.equal(CATEGORY_WEIGHT.vision, 1)
for (const id of ['creative-writing', 'vision']) {
  const inp = m.inputs.find((x) => x.benchmarkId === id)
  assert.ok(inp)
  assert.equal(inp.unit, 'elo')
  assert.equal(inp.higherIsBetter, true)
  const got = resolveRound(inp)
  assert.equal(got.showcase, false)
  assert.equal(got.winner, 'a')
  assert.equal(got.damage, 14)
}

// BattleRound 透传字段 + 回合号连续不断号（10.6 第 1、2、8 条）
const b = resolveBattle(m.inputs)
assert.deepEqual(b.rounds.map((r) => r.round), [1, 2, 3, 4, 5])
assert.equal(b.rounds[3].category, 'creative')
assert.equal(b.rounds[3].damage, 14)
assert.equal(b.rounds[4].category, 'vision')
assert.equal(b.rounds[4].damage, 14)
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

const scoredFromWeights = (Object.keys(CATEGORY_WEIGHT) as (keyof typeof CATEGORY_WEIGHT)[]).filter((k) => CATEGORY_WEIGHT[k] > 0)
assert.deepEqual([...SCORED_CATEGORIES], scoredFromWeights)

const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'hi', 'th', 'ru', 'pt']
assert.deepEqual(Object.keys(arenaMessages), locales)
for (const loc of locales) {
  const cats = arenaMessages[loc].categories
  for (const id of [...SCORED_CATEGORIES, 'pelican']) {
    assert.equal(typeof cats[id], 'string', `${loc} ${id}`)
    assert.ok(cats[id].trim().length > 0, `${loc} ${id}`)
  }
  if (loc !== 'en') assert.notEqual(cats.creative, arenaMessages.en.categories.creative, loc)
}
console.log('arena boards: ok')
