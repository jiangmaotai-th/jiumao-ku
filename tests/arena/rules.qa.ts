/**
 * 独立对照定稿的裁判规则验收。期望值按规格手算，不从 rules.ts 抄结果。
 * 规格：arena-battle-v2 第 3、4 节，以及其后定稿：
 * - 无残血保护、无护盾；格挡（原始分差落在置信区间内，含刚好贴边）伤害 0。
 * - 置信区间按原始分数取边：原始分高的一方用 ciDown，原始分低的一方用 ciUp，与 higherIsBetter 无关。
 * - 单回合伤害 min(22, round(w × (6 + 40 × g)))；代码 1.2、数学 0.8、其余计分类 1.0。
 * - 鹈鹕只演出，不记分，不计入计分回合。
 * - K.O. 后剩余回合照打、不再扣血，回合胜场照计。先被 K.O. 的一方输；否则剩余 HP 高者胜；HP 相同平局。
 * - 赢家回合胜场少于输家时才显示「赢的回合少、但优势更大」；平局永不显示。K.O. 后的回合胜场算进去。
 * - 单回合时长 = min(9, max(6.5, 46 / 计分回合)) 向上取到 0.01s。
 *   总时长 = 6 + 8 + 计分回合 × 单回合时长 + 鹈鹕 × 6.5。计分回合 ≥ 6 时总时长 ≥ 60s；恰好 6 回合落在 60–60.5s。
 * - applied 是这一下实际扣掉的血，补刀不超过对方剩余 HP；damage 仍是理论伤害。
 * - 首页预览取理论伤害最高的计分回合（按 damage，不是 applied），并列取最早；全格挡取第一个计分回合。
 *
 * 固定类别顺序、以及「没有共同数据的类别不要造回合」，没有单独的排序函数：
 * resolveBattle 按传入顺序结算。缺数据在这里表示为不传入该回合。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  CATEGORY_WEIGHT,
  DAMAGE_CAP,
  HP_MAX,
  INTRO_S,
  MIN_SCORED_ROUNDS,
  OUTRO_S,
  ROUND_MAX_S,
  ROUND_MIN_S,
  ROUNDS_BUDGET_S,
  SHOWCASE_S,
  battleDuration,
  pickPreviewRound,
  resolveBattle,
  resolveRound,
  roundDuration,
} from '../../src/arena/rules.ts'

/** @typedef {'arena'|'code'|'math'|'knowledge'|'index'|'pelican'} Cat */
/** @typedef {'a'|'b'|null} Side */

/**
 * @param {number} score
 * @param {number} [ciDown]
 * @param {number} [ciUp]
 */
function side(score, ciDown, ciUp) {
  return {
    score,
    ...(ciDown !== undefined ? { ciDown } : {}),
    ...(ciUp !== undefined ? { ciUp } : {}),
  }
}

/**
 * @param {Cat} category
 * @param {ReturnType<typeof side>} a
 * @param {ReturnType<typeof side>} b
 * @param {number} normSpan
 * @param {boolean} [higherIsBetter]
 */
function board(category, a, b, normSpan, higherIsBetter) {
  return higherIsBetter === undefined
    ? { category, a, b, normSpan }
    : { category, a, b, normSpan, higherIsBetter }
}

/** 规格：min(9, max(6.5, 46/n)) 向上取到 0.01 秒，返回百分秒整数。 */
function specRoundCents(scoredRounds) {
  if (scoredRounds <= 0) return 650
  if (4600 <= 650 * scoredRounds) return 650
  if (4600 >= 900 * scoredRounds) return 900
  return Math.floor((4600 + scoredRounds - 1) / scoredRounds)
}

function specBattleCents(scoredRounds, showcaseRounds = 0) {
  return 600 + 800 + scoredRounds * specRoundCents(scoredRounds) + showcaseRounds * 650
}

function cents(seconds) {
  return Math.round(seconds * 100)
}

/**
 * @param {number} actual
 * @param {number} expected
 * @param {string} label
 */
function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= 1e-10, `${label}: ${actual} !== ${expected}`)
}

describe('常量与类别权重', () => {
  test('权重：代码 1.2、数学 0.8、盲测/知识/综合 1.0、鹈鹕 0', () => {
    assert.equal(CATEGORY_WEIGHT.arena, 1)
    assert.equal(CATEGORY_WEIGHT.knowledge, 1)
    assert.equal(CATEGORY_WEIGHT.index, 1)
    assert.equal(CATEGORY_WEIGHT.code, 1.2)
    assert.equal(CATEGORY_WEIGHT.math, 0.8)
    assert.equal(CATEGORY_WEIGHT.pelican, 0)
  })

  test('HP 100、单回合封顶 22、最少 6 个计分回合才开战', () => {
    assert.equal(HP_MAX, 100)
    assert.equal(DAMAGE_CAP, 22)
    assert.equal(MIN_SCORED_ROUNDS, 6)
  })

  test('时长常数：开场 6、结算 8、预算 46、单回合 6.5–9、鹈鹕 6.5', () => {
    assert.equal(INTRO_S, 6)
    assert.equal(OUTRO_S, 8)
    assert.equal(ROUNDS_BUDGET_S, 46)
    assert.equal(ROUND_MIN_S, 6.5)
    assert.equal(ROUND_MAX_S, 9)
    assert.equal(SHOWCASE_S, 6.5)
  })
})

describe('单回合：伤害、格挡、暴击、权重', () => {
  const rows = [
    {
      name: '无置信区间且 g 刚好 0.05：命中，伤害 8，不是格挡',
      input: board('knowledge', side(100), side(95), 100),
      winner: 'a', blocked: false, crit: false, damage: 8, gap: 0.05,
    },
    {
      name: '无置信区间且 g 刚好低于 0.05（0.04）：格挡，伤害 0，无震伤',
      input: board('knowledge', side(100), side(96), 100),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0.04,
    },
    {
      name: '无置信区间 g=0.049：仍格挡',
      input: board('math', side(1000), side(951), 1000),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0.049,
    },
    {
      name: '分数相同：格挡，差距 0，即使带零宽度置信区间',
      input: board('arena', side(100, 0, 0), side(100, 0, 0), 50),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0,
    },
    {
      name: '越低越好且分数相同：仍格挡',
      input: board('knowledge', side(12), side(12), 40, false),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0,
    },
    {
      name: 'g=0.20 知识权重 1.0：round(14)=14',
      input: board('knowledge', side(92), side(88), 20),
      winner: 'a', blocked: false, crit: false, damage: 14, gap: 0.2,
    },
    {
      name: 'g=0.20 综合指数权重 1.0：同样 14',
      input: board('index', side(80), side(60), 100),
      winner: 'a', blocked: false, crit: false, damage: 14, gap: 0.2,
    },
    {
      name: 'g=0.20 盲测权重 1.0：14',
      input: board('arena', side(80), side(60), 100),
      winner: 'a', blocked: false, crit: false, damage: 14, gap: 0.2,
    },
    {
      name: 'g=0.20 代码权重 1.2：16.8 四舍五入为 17，胜方是分高的 B',
      input: board('code', side(80), side(86), 30),
      winner: 'b', blocked: false, crit: false, damage: 17, gap: 0.2,
    },
    {
      name: 'g=0.20 数学权重 0.8：11.2 四舍五入为 11',
      input: board('math', side(80), side(86), 30),
      winner: 'b', blocked: false, crit: false, damage: 11, gap: 0.2,
    },
    {
      name: '半入：13.5 向远离 0 舍入为 14，不是银行家舍入',
      input: board('knowledge', side(3), side(0), 16),
      winner: 'a', blocked: false, crit: false, damage: 14, gap: 0.1875,
    },
    {
      name: '刚好 13：不进位',
      input: board('index', side(7), side(0), 40),
      winner: 'a', blocked: false, crit: false, damage: 13, gap: 0.175,
    },
    {
      name: '伤害刚好 22：g=0.4，raw=22，同时暴击',
      input: board('knowledge', side(40), side(0), 100),
      winner: 'a', blocked: false, crit: true, damage: 22, gap: 0.4,
    },
    {
      name: '伤害刚好 22：21.5 四舍五入上来，g=0.3875 不到暴击线',
      input: board('arena', side(31), side(0), 80),
      winner: 'a', blocked: false, crit: false, damage: 22, gap: 0.3875,
    },
    {
      name: '伤害刚好停在 21：再小一档不封顶成 22',
      input: board('knowledge', side(30), side(0), 80),
      winner: 'a', blocked: false, crit: false, damage: 21, gap: 0.375,
    },
    {
      name: 'g=0.39 算出 21.6，四舍五入后也是 22，但还没到暴击',
      input: board('knowledge', side(39), side(0), 100),
      winner: 'a', blocked: false, crit: false, damage: 22, gap: 0.39,
    },
    {
      name: '代码权重 raw 刚好 22（g=37/120），未封顶截断，不暴击',
      input: board('code', side(37), side(0), 120),
      winner: 'a', blocked: false, crit: false, damage: 22, gap: 37 / 120,
    },
    {
      name: '代码权重 raw=22.5 先舍入成 23 再封顶为 22',
      input: board('code', side(51), side(0), 160),
      winner: 'a', blocked: false, crit: false, damage: 22, gap: 51 / 160,
    },
    {
      name: '差距超过归一跨度：g 截到 1，raw=46 封顶 22',
      input: board('knowledge', side(150), side(0), 100),
      winner: 'a', blocked: false, crit: true, damage: 22, gap: 1,
    },
    {
      name: '数学权重 g=1：36.8 封顶 22，仍暴击',
      input: board('math', side(100), side(0), 100),
      winner: 'a', blocked: false, crit: true, damage: 22, gap: 1,
    },
    {
      name: '暴击不加算伤害：Δ 刚好等于 2 倍阈值，不暴击，伤害 10',
      input: board('knowledge', side(100, 6, 1), side(80, 1, 4), 200),
      winner: 'a', blocked: false, crit: false, damage: 10, gap: 0.1,
    },
    {
      name: '暴击不加算伤害：Δ 比 2 倍阈值大 2，暴击，伤害仍是 10',
      input: board('knowledge', side(100, 5, 1), side(80, 1, 4), 200),
      winner: 'a', blocked: false, crit: true, damage: 10, gap: 0.1,
    },
    {
      name: 'g≥0.4 的大格挡不是暴击，伤害 0',
      input: board('arena', side(100, 25, 0), side(60, 0, 15), 50),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0.8,
    },
    {
      name: 'g 刚好 0.05 但原始分差等于置信区间：按区间格挡，伤害 0',
      input: board('arena', side(100, 3, 9), side(95, 9, 2), 100),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0.05,
    },
    {
      name: 'g 刚好 0.05 且原始分差比置信区间大 1：命中，伤害 8',
      input: board('arena', side(100, 3, 9), side(95, 9, 1), 100),
      winner: 'a', blocked: false, crit: false, damage: 8, gap: 0.05,
    },
    {
      name: 'g 远小于 0.05，但分差落在窄置信区间外：命中，不走 5% 规则',
      input: board('arena', side(1000, 2, 9), side(995, 9, 2), 10000),
      winner: 'a', blocked: false, crit: false, damage: 6, gap: 0.0005,
    },
    {
      name: '零宽度置信区间：任意正分差都命中，且 Δ > 2×0 所以暴击',
      input: board('arena', side(100, 0, 5), side(99, 5, 0), 100),
      winner: 'a', blocked: false, crit: true, damage: 6, gap: 0.01,
    },
    {
      name: '只有用不上的那一侧边距：视为没有置信区间，g<0.05 格挡',
      input: board('arena', side(100, undefined, 0), side(99, 0, undefined), 100),
      winner: null, blocked: true, crit: false, damage: 0, gap: 0.01,
    },
    {
      name: '越低越好、无置信区间：分低的 A 获胜，伤害按绝对差距',
      input: board('knowledge', side(10), side(30), 40, false),
      winner: 'a', blocked: false, crit: true, damage: 22, gap: 0.5,
    },
    {
      name: '同一对分数越高越好：胜方翻成 B，伤害不变',
      input: board('knowledge', side(10), side(30), 40, true),
      winner: 'b', blocked: false, crit: true, damage: 22, gap: 0.5,
    },
    {
      name: '未写 higherIsBetter 时默认越高越好',
      input: board('index', side(10), side(30), 40),
      winner: 'b', blocked: false, crit: true, damage: 22, gap: 0.5,
    },
    {
      name: '鹈鹕只演出：有分差也不计胜负、不格挡、不造成伤害',
      input: board('pelican', side(1, 0, 0), side(99, 0, 0), 10),
      winner: null, blocked: false, crit: false, damage: 0, gap: 0, showcase: true,
    },
  ]

  for (const row of rows) {
    test(row.name, () => {
      const got = resolveRound(row.input)
      assert.equal(got.winner, row.winner, 'winner')
      assert.equal(got.blocked, row.blocked, 'blocked')
      assert.equal(got.crit, row.crit, 'crit')
      assert.equal(got.damage, row.damage, 'damage')
      assert.equal(got.showcase, row.showcase ?? false, 'showcase')
      assertClose(got.gap, row.gap, 'gap')
      if (row.blocked || row.showcase) assert.equal(got.damage, 0)
      if (!row.blocked && !row.showcase) assert.ok(got.damage > 0 && got.damage <= 22)
    })
  }

  test('计分类 normSpan ≤ 0 拒绝结算；鹈鹕不看 normSpan', () => {
    assert.throws(() => resolveRound(board('knowledge', side(1), side(2), 0)), /normSpan/)
    assert.throws(() => resolveRound(board('code', side(1), side(2), -5)), /normSpan/)
    const show = resolveRound(board('pelican', side(1), side(2), 0))
    assert.equal(show.showcase, true)
    assert.equal(show.damage, 0)
  })
})

describe('置信区间贴边：按原始分取边距，两个方向', () => {
  const rows = [
    {
      name: '越高越好，A 原始分高，分差刚好等于区间：格挡。用反了边距会放行',
      input: board('arena', side(100, 4, 0), side(90, 0, 6), 100),
      winner: null, blocked: true, damage: 0, gap: 0.1,
    },
    {
      name: '越高越好，A 原始分高，分差比区间大 1：A 命中。诱饵边距很大，用反了会格挡',
      input: board('arena', side(100, 4, 100), side(90, 100, 5), 100),
      winner: 'a', blocked: false, damage: 10, gap: 0.1,
    },
    {
      name: '越高越好，B 原始分高，分差刚好等于区间：格挡',
      input: board('arena', side(90, 0, 6), side(100, 4, 0), 100),
      winner: null, blocked: true, damage: 0, gap: 0.1,
    },
    {
      name: '越高越好，B 原始分高，分差比区间大 1：B 命中',
      input: board('arena', side(90, 100, 5), side(100, 4, 100), 100),
      winner: 'b', blocked: false, damage: 10, gap: 0.1,
    },
    {
      name: '越低越好，A 原始分更低所以占优，分差刚好等于区间：格挡。按占优方向取边距会放行',
      input: board('knowledge', side(10, 8, 4), side(20, 6, 1), 100, false),
      winner: null, blocked: true, damage: 0, gap: 0.1,
    },
    {
      name: '越低越好，A 占优，分差比区间大 1：A 命中。按占优方向取边距会格挡',
      input: board('knowledge', side(10, 50, 3), side(20, 6, 50), 100, false),
      winner: 'a', blocked: false, damage: 10, gap: 0.1,
    },
    {
      name: '越低越好，B 原始分更低所以占优，分差刚好等于区间：格挡',
      input: board('knowledge', side(20, 6, 8), side(10, 1, 4), 100, false),
      winner: null, blocked: true, damage: 0, gap: 0.1,
    },
    {
      name: '越低越好，B 占优，分差比区间大 1：B 命中',
      input: board('knowledge', side(20, 6, 50), side(10, 50, 3), 100, false),
      winner: 'b', blocked: false, damage: 10, gap: 0.1,
    },
  ]

  for (const row of rows) {
    test(row.name, () => {
      const got = resolveRound(row.input)
      assert.equal(got.blocked, row.blocked, 'blocked')
      assert.equal(got.winner, row.winner, 'winner')
      assert.equal(got.damage, row.damage, 'damage')
      assert.equal(got.crit, false, 'crit')
      assert.equal(got.showcase, false)
      assertClose(got.gap, row.gap, 'gap')
    })
  }

  test('同一套原始分和区间，higherIsBetter 只翻胜方，不翻格挡判定', () => {
    const scores = [side(10, 50, 3), side(20, 6, 50)]
    const lowWins = resolveRound(board('knowledge', scores[0], scores[1], 100, false))
    const highWins = resolveRound(board('knowledge', scores[0], scores[1], 100, true))
    assert.equal(lowWins.blocked, false)
    assert.equal(highWins.blocked, false)
    assert.equal(lowWins.winner, 'a')
    assert.equal(highWins.winner, 'b')
    assert.equal(lowWins.damage, highWins.damage)

    const edge = [side(10, 8, 4), side(20, 6, 1)]
    const lowEdge = resolveRound(board('knowledge', edge[0], edge[1], 100, false))
    const highEdge = resolveRound(board('knowledge', edge[0], edge[1], 100, true))
    assert.equal(lowEdge.blocked, true)
    assert.equal(highEdge.blocked, true)
    assert.equal(lowEdge.damage, 0)
    assert.equal(highEdge.damage, 0)
    assert.equal(lowEdge.winner, null)
    assert.equal(highEdge.winner, null)
  })
})

const A22 = board('code', side(100), side(0), 10)
const B22 = board('code', side(0), side(100), 10)
const A20 = board('knowledge', side(35), side(0), 100)
const B20 = board('knowledge', side(0), side(35), 100)
const A14 = board('knowledge', side(92), side(88), 20)
const B14 = board('arena', side(88), side(92), 20)
const A12 = board('knowledge', side(15), side(0), 100)
const B12 = board('knowledge', side(0), side(15), 100)
const B11 = board('index', side(0), side(1), 8)
const A8 = board('knowledge', side(5), side(0), 100)
const BLOCK = board('arena', side(1500, 10, 10), side(1495, 10, 10), 100)
const PELICAN = board('pelican', side(3), side(90), 10)

function repeat(n, value) {
  return Array.from({ length: n }, () => value)
}

/** 一方实际扣血合计 = 100 − 该方最终 HP。A 命中扣 B，B 命中扣 A。 */
function assertAppliedAccountsForHp(battle) {
  let removedFromA = 0
  let removedFromB = 0
  for (const round of battle.rounds) {
    if (round.winner === 'a') removedFromB += round.applied
    else if (round.winner === 'b') removedFromA += round.applied
    else assert.equal(round.applied, 0)
  }
  assert.equal(removedFromA, 100 - battle.hpA, 'A 的 applied 合计')
  assert.equal(removedFromB, 100 - battle.hpB, 'B 的 applied 合计')
}

describe('整场：K.O.、平局、说明句、无护盾', () => {
  test('五次 20 点伤害刚好打到 0：这一下是 K.O.，HP 不为负', () => {
    const battle = resolveBattle([...repeat(5, A20), A20])
    assert.deepEqual(battle.rounds.slice(0, 5).map((r) => r.hpB), [80, 60, 40, 20, 0])
    assert.deepEqual(battle.rounds.slice(0, 5).map((r) => r.applied), [20, 20, 20, 20, 20])
    assert.equal(battle.rounds[4].afterKo, false)
    assert.equal(battle.rounds[4].damage, 20)
    assert.equal(battle.rounds[5].afterKo, true)
    assert.equal(battle.rounds[5].applied, 0)
    assert.equal(battle.rounds[5].hpA, 100)
    assert.equal(battle.rounds[5].hpB, 0)
    assert.equal(battle.rounds[5].winner, 'a')
    assert.equal(battle.ko, 'b')
    assert.equal(battle.outcome, 'a')
    assert.equal(battle.decidedBy, 'ko')
    assert.equal(battle.roundWinsA, 6)
    assert.equal(battle.roundWinsB, 0)
    assert.equal(battle.showUnderdogNote, false)
    assertAppliedAccountsForHp(battle)
  })

  test('超杀：剩余 12 点承受 22 点，applied 记 12，damage 仍是 22', () => {
    const battle = resolveBattle([...repeat(5, A22), B22])
    assert.deepEqual(battle.rounds.slice(0, 5).map((r) => r.hpB), [78, 56, 34, 12, 0])
    assert.deepEqual(battle.rounds.slice(0, 5).map((r) => r.applied), [22, 22, 22, 22, 12])
    assert.equal(battle.rounds[4].applied, 12)
    assert.equal(battle.rounds[4].damage, 22)
    assert.ok(battle.rounds.every((r) => r.hpA >= 0 && r.hpB >= 0))
    assert.equal(battle.rounds[5].afterKo, true)
    assert.equal(battle.rounds[5].applied, 0)
    assert.equal(battle.rounds[5].winner, 'b')
    assert.equal(battle.rounds[5].damage, 22)
    assert.equal(battle.hpA, 100)
    assert.equal(battle.hpB, 0)
    assert.equal(battle.ko, 'b')
    assert.equal(battle.outcome, 'a')
    assert.equal(battle.roundWinsA, 5)
    assert.equal(battle.roundWinsB, 1)
    assert.equal(battle.showUnderdogNote, false)
    assertAppliedAccountsForHp(battle)
  })

  test('无残血保护、无护盾：回合还没打完时 HP 可以降到 10 以下，命中不吸收伤害', () => {
    const battle = resolveBattle([...repeat(4, A22), A8, BLOCK, BLOCK, BLOCK])
    assert.deepEqual(battle.rounds.map((r) => r.hpB), [78, 56, 34, 12, 4, 4, 4, 4])
    assert.deepEqual(battle.rounds.slice(0, 5).map((r) => r.applied), [22, 22, 22, 22, 8])
    assert.equal(battle.rounds[4].afterKo, false)
    assert.equal(battle.rounds[4].hpB, 4)
    assert.equal(battle.ko, null)
    assert.equal(battle.outcome, 'a')
    assert.equal(battle.decidedBy, 'hp')
    assert.equal(battle.hpA, 100)
    assert.equal(battle.hpB, 4)
    assert.equal(battle.showUnderdogNote, false)
    assertAppliedAccountsForHp(battle)
  })

  test('同时看起来都能倒下：先被打到 0 的一方输，后手那一击不改写 K.O.', () => {
    const battle = resolveBattle([
      A20, B20, A20, B20, A20, B20, A20, B20,
      A20,
      B20, B20, B20,
    ])
    assert.deepEqual(battle.rounds.slice(0, 8).map((r) => [r.hpA, r.hpB]), [
      [100, 80],
      [80, 80],
      [80, 60],
      [60, 60],
      [60, 40],
      [40, 40],
      [40, 20],
      [20, 20],
    ])
    assert.equal(battle.rounds[8].afterKo, false)
    assert.equal(battle.rounds[8].applied, 20)
    assert.equal(battle.rounds[8].hpA, 20)
    assert.equal(battle.rounds[8].hpB, 0)
    assert.deepEqual(battle.rounds.slice(9).map((r) => [r.afterKo, r.applied, r.hpA, r.hpB, r.winner]), [
      [true, 0, 20, 0, 'b'],
      [true, 0, 20, 0, 'b'],
      [true, 0, 20, 0, 'b'],
    ])
    assert.equal(battle.ko, 'b')
    assert.equal(battle.outcome, 'a')
    assert.equal(battle.decidedBy, 'ko')
    assert.equal(battle.hpA, 20)
    assert.equal(battle.hpB, 0)
    assert.equal(battle.roundWinsA, 5)
    assert.equal(battle.roundWinsB, 7)
    assert.equal(battle.showUnderdogNote, true)
    assertAppliedAccountsForHp(battle)
  })

  const outcomes = [
    {
      name: 'HP 胜，赢家回合更少：显示说明句',
      inputs: [A22, B12, A22, B12, B12],
      outcome: 'a', decidedBy: 'hp', ko: null, hpA: 64, hpB: 56, winsA: 2, winsB: 3, note: true,
    },
    {
      name: 'HP 胜，赢家回合更多：不显示说明句',
      inputs: [A14, A14, A14, B22],
      outcome: 'a', decidedBy: 'hp', ko: null, hpA: 78, hpB: 58, winsA: 3, winsB: 1, note: false,
    },
    {
      name: 'HP 胜，回合胜场相同：不显示说明句',
      inputs: [A22, B14, A22, B14],
      outcome: 'a', decidedBy: 'hp', ko: null, hpA: 72, hpB: 56, winsA: 2, winsB: 2, note: false,
    },
    {
      name: 'HP 相同但回合胜场不同：平局，不显示说明句',
      inputs: [A22, B11, B11],
      outcome: 'draw', decidedBy: 'draw', ko: null, hpA: 78, hpB: 78, winsA: 1, winsB: 2, note: false,
    },
    {
      name: '六回合全格挡：100 对 100 平局，不显示说明句',
      inputs: repeat(6, BLOCK),
      outcome: 'draw', decidedBy: 'draw', ko: null, hpA: 100, hpB: 100, winsA: 0, winsB: 0, note: false,
    },
    {
      name: 'K.O. 后对方多拿回合：说明句要算上 K.O. 之后的胜场',
      inputs: [...repeat(5, A22), ...repeat(6, B14)],
      outcome: 'a', decidedBy: 'ko', ko: 'b', hpA: 100, hpB: 0, winsA: 5, winsB: 6, note: true,
    },
    {
      name: 'K.O. 后回合胜场刚好打平：赢家并非更少，不显示说明句',
      inputs: [...repeat(5, A22), ...repeat(5, B14)],
      outcome: 'a', decidedBy: 'ko', ko: 'b', hpA: 100, hpB: 0, winsA: 5, winsB: 5, note: false,
    },
    {
      name: 'K.O. 后赢家回合仍然更多：不显示说明句',
      inputs: [...repeat(5, A22), ...repeat(4, B14)],
      outcome: 'a', decidedBy: 'ko', ko: 'b', hpA: 100, hpB: 0, winsA: 5, winsB: 4, note: false,
    },
    {
      name: '先被 K.O. 的是 A，B 回合更少：说明句仍出现',
      inputs: [...repeat(5, B22), ...repeat(6, A14)],
      outcome: 'b', decidedBy: 'ko', ko: 'a', hpA: 0, hpB: 100, winsA: 6, winsB: 5, note: true,
    },
    {
      name: '格挡不记回合胜场',
      inputs: [BLOCK, A14, BLOCK],
      outcome: 'a', decidedBy: 'hp', ko: null, hpA: 100, hpB: 86, winsA: 1, winsB: 0, note: false,
    },
    {
      name: '鹈鹕夹在中间：不扣血、不记胜场',
      inputs: [A14, PELICAN, B14],
      outcome: 'draw', decidedBy: 'draw', ko: null, hpA: 86, hpB: 86, winsA: 1, winsB: 1, note: false,
    },
  ]

  for (const row of outcomes) {
    test(row.name, () => {
      const battle = resolveBattle(row.inputs)
      assert.equal(battle.outcome, row.outcome, 'outcome')
      assert.equal(battle.decidedBy, row.decidedBy, 'decidedBy')
      assert.equal(battle.ko, row.ko, 'ko')
      assert.equal(battle.hpA, row.hpA, 'hpA')
      assert.equal(battle.hpB, row.hpB, 'hpB')
      assert.equal(battle.roundWinsA, row.winsA, 'winsA')
      assert.equal(battle.roundWinsB, row.winsB, 'winsB')
      assert.equal(battle.showUnderdogNote, row.note, 'note')
      assert.equal(battle.rounds.length, row.inputs.length)
      assertAppliedAccountsForHp(battle)
    })
  }

  test('K.O. 后的命中仍记理论伤害，但 applied 为 0', () => {
    const battle = resolveBattle([...repeat(5, A22), ...repeat(6, B14)])
    assert.ok(battle.rounds.slice(5).every((r) => r.afterKo && r.applied === 0 && r.damage === 14 && r.winner === 'b'))
    assert.equal(battle.hpA, 100)
    assert.equal(battle.hpB, 0)
    assert.equal(battle.rounds[4].applied, 12)
    assert.equal(battle.rounds[4].damage, 22)
    assertAppliedAccountsForHp(battle)
  })

  test('空输入按相同 HP 平局，不显示说明句', () => {
    const battle = resolveBattle([])
    assert.equal(battle.outcome, 'draw')
    assert.equal(battle.hpA, 100)
    assert.equal(battle.hpB, 100)
    assert.equal(battle.showUnderdogNote, false)
    assert.equal(battle.roundWinsA, 0)
    assert.equal(battle.roundWinsB, 0)
    assertAppliedAccountsForHp(battle)
  })
})

describe('设计稿示例对局按定稿重算', () => {
  const example = [
    board('arena', side(1490, 6, 6), side(1482, 7, 7), 120),
    board('knowledge', side(92), side(88), 20),
    board('code', side(80), side(86), 30),
    board('math', side(95), side(94), 25),
    board('arena', side(1450, 10, 10), side(1390, 10, 10), 200),
    board('code', side(70), side(76), 25),
    board('knowledge', side(40), side(31), 30),
    board('knowledge', side(60), side(72), 40),
    board('index', side(60), side(58), 20),
  ]

  const expected = [
    { winner: null, blocked: true, crit: false, damage: 0, gap: 8 / 120, hpA: 100, hpB: 100 },
    { winner: 'a', blocked: false, crit: false, damage: 14, gap: 0.2, hpA: 100, hpB: 86 },
    { winner: 'b', blocked: false, crit: false, damage: 17, gap: 0.2, hpA: 83, hpB: 86 },
    { winner: null, blocked: true, crit: false, damage: 0, gap: 0.04, hpA: 83, hpB: 86 },
    { winner: 'a', blocked: false, crit: true, damage: 18, gap: 0.3, hpA: 83, hpB: 68 },
    { winner: 'b', blocked: false, crit: false, damage: 19, gap: 0.24, hpA: 64, hpB: 68 },
    { winner: 'a', blocked: false, crit: false, damage: 18, gap: 0.3, hpA: 64, hpB: 50 },
    { winner: 'b', blocked: false, crit: false, damage: 18, gap: 0.3, hpA: 46, hpB: 50 },
    { winner: 'a', blocked: false, crit: false, damage: 10, gap: 0.1, hpA: 46, hpB: 40 },
  ]

  test('九回合示例：格挡无震伤，盲测权重 1.0 所以第 5 回合是 18 不是 22', () => {
    const battle = resolveBattle(example)
    expected.forEach((row, i) => {
      const got = battle.rounds[i]
      assert.equal(got.winner, row.winner, `r${i + 1} winner`)
      assert.equal(got.blocked, row.blocked, `r${i + 1} blocked`)
      assert.equal(got.crit, row.crit, `r${i + 1} crit`)
      assert.equal(got.damage, row.damage, `r${i + 1} damage`)
      assert.equal(got.applied, row.damage, `r${i + 1} applied`)
      assert.equal(got.hpA, row.hpA, `r${i + 1} hpA`)
      assert.equal(got.hpB, row.hpB, `r${i + 1} hpB`)
      assert.equal(got.afterKo, false, `r${i + 1} afterKo`)
      assertClose(got.gap, row.gap, `r${i + 1} gap`)
    })
    assert.equal(battle.outcome, 'a')
    assert.equal(battle.decidedBy, 'hp')
    assert.equal(battle.ko, null)
    assert.equal(battle.hpA, 46)
    assert.equal(battle.hpB, 40)
    assert.equal(battle.roundWinsA, 4)
    assert.equal(battle.roundWinsB, 3)
    assert.equal(battle.showUnderdogNote, false)
    assert.equal(pickPreviewRound(battle.rounds), 5)
    assertAppliedAccountsForHp(battle)
    assert.equal(cents(battleDuration(9)), specBattleCents(9))
    assert.equal(cents(battleDuration(9)), 7250)
  })
})

describe('时长', () => {
  const named = [
    { n: 1, cents: 900, why: '1 回合撞上 9 秒上限' },
    { n: 4, cents: 900, why: '4 回合仍是 9 秒上限' },
    { n: 5, cents: 900, why: '5 回合是最后一个吃到 9 秒上限的整数回合数' },
    { n: 6, cents: 767, why: '6 回合 46/6 向上取到 7.67 秒，不是 7.66' },
    { n: 7, cents: 658, why: '7 回合向上取到 6.58 秒，不是四舍五入的 6.57' },
    { n: 8, cents: 650, why: '8 回合起踩上 6.5 秒下限' },
    { n: 9, cents: 650, why: '9 回合仍是 6.5 秒下限' },
    { n: 12, cents: 650, why: '12 回合仍是 6.5 秒下限' },
    { n: 20, cents: 650, why: '20 回合仍是 6.5 秒下限' },
    { n: 30, cents: 650, why: '30 回合仍是 6.5 秒下限，不会再缩短' },
    { n: 48, cents: 650, why: '很多回合仍然是 6.5 秒' },
  ]

  for (const row of named) {
    test(row.why, () => {
      assert.equal(cents(roundDuration(row.n)), row.cents)
      assert.equal(cents(roundDuration(row.n)), specRoundCents(row.n))
      const raw = Math.min(9, Math.max(6.5, 46 / row.n))
      const got = roundDuration(row.n)
      assert.ok(got + 1e-9 >= raw, `${got} 短于未取整的 ${raw}`)
      assert.ok(got < raw + 0.01 + 1e-9, `${got} 多取了超过 0.01 秒`)
    })
  }

  test('恰好 6 个计分回合：总时长在 60 到 60.5 秒，且等于向上取整后的 60.02 秒', () => {
    const inputs = [A14, B14, A20, B20, BLOCK, A8]
    const scored = inputs.map(resolveRound).filter((r) => !r.showcase)
    assert.equal(scored.length, 6)
    assert.equal(resolveBattle(inputs).rounds.length, 6)
    const total = cents(battleDuration(6))
    assert.ok(total >= 6000 && total <= 6050, `总时长百分秒 ${total}`)
    assert.equal(total, 6002)
    assert.equal(total, specBattleCents(6))
  })

  test('6 个计分回合再加鹈鹕：多 6.5 秒，不把鹈鹕算进 46 秒的分母', () => {
    const withPelican = cents(battleDuration(6, 1))
    assert.equal(withPelican, 6002 + 650)
    assert.equal(withPelican, specBattleCents(6, 1))
    assert.notEqual(withPelican, specBattleCents(7, 0))
    assert.equal(cents(roundDuration(6)), 767)
    assert.equal(cents(battleDuration(6, 2)), specBattleCents(6, 2))
  })

  for (let n = 6; n <= 40; n++) {
    test(`${n} 个计分回合总时长不少于 60 秒，且符合向上取整公式`, () => {
      const total = cents(battleDuration(n))
      assert.ok(total >= 6000, `${n} 回合只有 ${total / 100}s`)
      assert.equal(total, specBattleCents(n))
      assert.equal(cents(roundDuration(n)), specRoundCents(n))
    })
  }

  test('不足 6 个计分回合不开战；5 回合的单回合时长仍是 9 秒上限', () => {
    assert.equal(cents(roundDuration(5)), 900)
    assert.equal(cents(battleDuration(5)), 5900)
    assert.ok(battleDuration(5) < 60)
  })
})

describe('首页预览', () => {
  test('补刀回合 damage 仍是 22，预览按 damage 而不是 applied=12', () => {
    const battle = resolveBattle([...repeat(4, A20), A8, A22])
    assert.deepEqual(battle.rounds.map((r) => r.hpB), [80, 60, 40, 20, 12, 0])
    assert.equal(battle.rounds[5].applied, 12)
    assert.equal(battle.rounds[5].damage, 22)
    assert.equal(pickPreviewRound(battle.rounds), 5)
    assertAppliedAccountsForHp(battle)
  })

  test('K.O. 之后理论伤害更高的回合入选，即使实际扣血是 0', () => {
    const battle = resolveBattle([...repeat(5, A20), A22])
    assert.equal(battle.rounds[5].afterKo, true)
    assert.equal(battle.rounds[5].applied, 0)
    assert.equal(battle.rounds[5].damage, 22)
    assert.ok(battle.rounds.slice(0, 5).every((r) => r.damage === 20 && r.applied === 20))
    assert.equal(pickPreviewRound(battle.rounds), 5)
  })

  test('理论伤害并列时取最早的回合，K.O. 后的同伤害回合不插队', () => {
    const battle = resolveBattle(repeat(6, A22))
    assert.equal(battle.rounds[5].afterKo, true)
    assert.equal(battle.rounds[5].applied, 0)
    assert.equal(battle.rounds[5].damage, 22)
    assert.equal(pickPreviewRound(battle.rounds), 0)
  })

  test('未 K.O. 时并列也取最早', () => {
    const rounds = [A14, A22, A20, A22].map(resolveRound)
    assert.deepEqual(rounds.map((r) => r.damage), [14, 22, 20, 22])
    assert.equal(pickPreviewRound(rounds), 1)
  })

  test('全格挡取第一个计分回合，不取差距更大但仍是 0 伤害的格挡', () => {
    const small = board('arena', side(100, 1, 1), side(99, 1, 5), 100)
    const big = board('arena', side(100, 20, 0), side(60, 0, 20), 50)
    const battle = resolveBattle([small, big, small])
    assert.ok(battle.rounds.every((r) => r.blocked && r.damage === 0))
    assert.ok(battle.rounds[1].gap > battle.rounds[0].gap)
    assert.equal(pickPreviewRound(battle.rounds), 0)
  })

  test('鹈鹕排在最前时，全格挡仍取第一个计分回合', () => {
    const battle = resolveBattle([PELICAN, BLOCK, BLOCK])
    assert.equal(battle.rounds[0].showcase, true)
    assert.equal(pickPreviewRound(battle.rounds), 1)
  })

  test('只有鹈鹕或没有回合：没有可预览的计分回合', () => {
    assert.equal(pickPreviewRound([resolveRound(PELICAN), resolveRound(PELICAN)]), -1)
    assert.equal(pickPreviewRound([]), -1)
  })

  test('同差距时权重大的回合理论伤害更高', () => {
    const know = resolveRound(board('knowledge', side(80), side(60), 100))
    const code = resolveRound(board('code', side(80), side(60), 100))
    assert.equal(know.damage, 14)
    assert.equal(code.damage, 17)
    assert.equal(pickPreviewRound([know, code]), 1)
    assert.equal(pickPreviewRound([code, know]), 0)
  })
})

describe('没有共同数据的类别不占回合、不占时长', () => {
  test('数学和鹈鹕都没有数据：不造回合，时长按剩下的 6 个计分回合', () => {
    const inputs = [
      board('arena', side(80), side(60), 100),
      board('arena', side(70), side(60), 100),
      board('knowledge', side(90), side(70), 100),
      board('knowledge', side(88), side(70), 100),
      board('code', side(80), side(60), 100),
      board('index', side(70), side(60), 100),
    ]
    assert.ok(inputs.every((r) => r.category !== 'math' && r.category !== 'pelican'))
    const battle = resolveBattle(inputs)
    assert.equal(battle.rounds.length, 6)
    assert.ok(battle.rounds.every((r) => !r.showcase))
    const total = cents(battleDuration(6, 0))
    assert.equal(total, specBattleCents(6, 0))
    assert.notEqual(total, specBattleCents(7, 0))
    assert.notEqual(total, specBattleCents(6, 1))
    assert.ok(total >= 6000 && total <= 6050)
  })

  test('五类计分榜都在、另加鹈鹕：鹈鹕不计入计分回合数', () => {
    const inputs = [
      board('arena', side(80), side(60), 100),
      board('knowledge', side(90), side(70), 100),
      board('math', side(95), side(90), 100),
      board('code', side(80), side(60), 100),
      board('index', side(70), side(60), 100),
      PELICAN,
    ]
    const results = inputs.map(resolveRound)
    const scored = results.filter((r) => !r.showcase).length
    const showcase = results.filter((r) => r.showcase).length
    assert.equal(scored, 5)
    assert.equal(showcase, 1)
    assert.equal(results[5].winner, null)
    assert.equal(results[5].damage, 0)
    const battle = resolveBattle(inputs)
    assert.equal(battle.roundWinsA + battle.roundWinsB, results.filter((r) => r.winner).length)
    assert.equal(cents(battleDuration(scored, showcase)), specBattleCents(5, 1))
    assert.notEqual(specBattleCents(5, 1), specBattleCents(6, 0))
  })

  test('resolveBattle 不重排、不增删传入回合', () => {
    const third = board('arena', side(2), side(0), 10)
    const inputs = [PELICAN, A22, third]
    const battle = resolveBattle(inputs)
    assert.equal(battle.rounds.length, 3)
    assert.equal(battle.rounds[0].showcase, true)
    assert.equal(battle.rounds[0].damage, 0)
    assert.equal(battle.rounds[1].damage, 22)
    assert.equal(battle.rounds[1].winner, 'a')
    assert.equal(battle.rounds[2].damage, resolveRound(third).damage)
    assert.equal(battle.rounds[2].winner, 'a')
  })
})
