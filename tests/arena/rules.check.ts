import assert from 'node:assert/strict'
import { resolveRound, resolveBattle, battleDuration, roundDuration, pickPreviewRound } from '../../src/arena/rules.ts'

// 格挡：Δ8 ≤ 6+7，伤害 0，无震伤
let r = resolveRound({ category: 'arena', a: { score: 1490, ciDown: 6, ciUp: 6 }, b: { score: 1482, ciDown: 7, ciUp: 7 }, normSpan: 120 })
assert.equal(r.blocked, true); assert.equal(r.damage, 0); assert.equal(r.winner, null)
// 命中：GPQA 92 vs 88，D=20 → g=0.2 → 14
r = resolveRound({ category: 'knowledge', a: { score: 92 }, b: { score: 88 }, normSpan: 20 })
assert.equal(r.winner, 'a'); assert.equal(r.damage, 14)
// 编程权重 1.2：g=0.2 → 16.8 → 17
r = resolveRound({ category: 'code', a: { score: 80 }, b: { score: 86 }, normSpan: 30 })
assert.equal(r.winner, 'b'); assert.equal(r.damage, 17)
// 封顶 22 + 暴击
r = resolveRound({ category: 'code', a: { score: 100 }, b: { score: 0 }, normSpan: 10 })
assert.equal(r.damage, 22); assert.equal(r.crit, true)
// 无 CI 时 g<0.05 判格挡
r = resolveRound({ category: 'math', a: { score: 95 }, b: { score: 94 }, normSpan: 25 })
assert.equal(r.blocked, true)
// 越低越好
r = resolveRound({ category: 'knowledge', a: { score: 10 }, b: { score: 20 }, normSpan: 20, higherIsBetter: false })
assert.equal(r.winner, 'a')
// 越低越好且带置信区间：A=10(ciUp 3, ciDown 9) B=20(ciUp 9, ciDown 4)。区间靠近的是 A 上边距 3 + B 下边距 4 = 7
r = resolveRound({ category: 'knowledge', a: { score: 10, ciUp: 3, ciDown: 9 }, b: { score: 20, ciUp: 9, ciDown: 4 }, normSpan: 40, higherIsBetter: false })
assert.equal(r.blocked, false); assert.equal(r.winner, 'a')
r = resolveRound({ category: 'knowledge', a: { score: 10, ciUp: 6, ciDown: 1 }, b: { score: 20, ciUp: 1, ciDown: 5 }, normSpan: 40, higherIsBetter: false })
assert.equal(r.blocked, true)
// 鹈鹕只演出
r = resolveRound({ category: 'pelican', a: { score: 0 }, b: { score: 0 }, normSpan: 1 })
assert.equal(r.showcase, true); assert.equal(r.damage, 0)

// K.O. 后照打，不再扣血；追加回合计入回合胜场
const crush = { category: 'code' as const, a: { score: 100 }, b: { score: 0 }, normSpan: 10 }
const lose = { category: 'knowledge' as const, a: { score: 0 }, b: { score: 10 }, normSpan: 20 }
let b = resolveBattle([crush, crush, crush, crush, crush, lose, lose, lose, lose, lose, lose])
assert.equal(b.ko, 'b'); assert.equal(b.outcome, 'a'); assert.equal(b.decidedBy, 'ko')
assert.equal(b.hpA, 100); assert.ok(b.rounds.slice(5).every((x) => x.afterKo && x.applied === 0))
assert.equal(b.roundWinsA, 5); assert.equal(b.roundWinsB, 6); assert.equal(b.showUnderdogNote, true)

// 全格挡 100:100 → 平局，不显示说明句
const block = { category: 'arena' as const, a: { score: 1500, ciDown: 10, ciUp: 10 }, b: { score: 1495, ciDown: 10, ciUp: 10 }, normSpan: 100 }
b = resolveBattle([block, block, block, block, block, block])
assert.equal(b.outcome, 'draw'); assert.equal(b.hpA, 100); assert.equal(b.hpB, 100); assert.equal(b.showUnderdogNote, false)
// 掉血相同 → 平局
const hitA = { category: 'knowledge' as const, a: { score: 92 }, b: { score: 88 }, normSpan: 20 }
const hitB = { category: 'knowledge' as const, a: { score: 88 }, b: { score: 92 }, normSpan: 20 }
b = resolveBattle([hitA, hitB, block, block, block, block])
assert.equal(b.outcome, 'draw'); assert.equal(b.decidedBy, 'draw')
// 按 HP 判胜
b = resolveBattle([hitA, hitA, hitB, block, block, block])
assert.equal(b.outcome, 'a'); assert.equal(b.decidedBy, 'hp')

// 时长：只许多不许少
assert.ok(battleDuration(6) >= 60 && battleDuration(6) <= 60.5)
assert.equal(roundDuration(12), 6.5)
for (let n = 6; n <= 20; n++) assert.ok(battleDuration(n) >= 60, `n=${n}`)
assert.ok(battleDuration(6, 1) >= 66.5)

// 预览：理论伤害最高，并列取前；K.O. 后回合也可选
b = resolveBattle([crush, crush, crush, crush, crush, { ...crush }])
assert.equal(pickPreviewRound(b.rounds), 0)
assert.equal(pickPreviewRound(resolveBattle([block, block]).rounds), 0)
assert.equal(pickPreviewRound([resolveRound(hitA), resolveRound(crush)]), 1)
// 补刀：剩 12 血时一下 22，applied 记 12
b = resolveBattle([crush, crush, crush, crush, crush])
assert.equal(b.rounds[4].hpB, 0); assert.equal(b.rounds[4].applied, 12); assert.equal(b.rounds[4].damage, 22)
console.log('rules.check: all passed')
