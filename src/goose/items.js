import { LEVELS } from './levels.js'

export function freshRun(diff = 'normal') {
  return {
    mode: 'story',
    diff,
    coins: 0,
    geese: 0,
    catchN: 0,
    throwCount: 1,
    coinMul: 1,
    slack: 0,
    magnet: 0,
    freezeUntil: 0,
    noDuck: false,
    slowMul: 1,
    sticky: false,
    refund: false,
    dual: false,
    backBonus: 1,
    nextBonus: 1,
    sale: 1,
    missSave: 0,
    keepMissSave: false,
    streakOn: false,
    streak: 0,
    aoe: false,
    charm: false,
    light: false,
    persistMul: 1,
    doubleRingChance: 0,
    fan: 0,
    pitchFan: 0,
    dualMax: 1,
    aoeR: 0,
    aoeN: 0,
    streakRate: 0.3,
    noWind: false,
    lightBoost: 1,
    charmN: 3,
    owned: [],
    styleTitle: '',
    styleBlurb: '',
    lastStyle: '',
    lastLevel: '',
  }
}

export const CAMPAIGN = [
  { id: 'stall', title: '夜市地摊', blurb: '风平浪静，好好瞄准', level: 1 },
  { id: 'wind', title: '庙会风口', blurb: '大风会把圈吹歪', level: 2 },
  { id: 'stroll', title: '遛弯鹅场', blurb: '鹅开始四处散步', level: 3 },
  { id: 'rain', title: '雨夜湿滑', blurb: '地垫又滑又弹', level: 4 },
  { id: 'stampede', title: '鹅群暴走', blurb: '晃得更凶、躲得更快', level: 5 },
  { id: 'boss', title: '鹅王驾到', blurb: '三血鹅王出现了', level: 6 },
]

export const SHOP = [
  { id: 'pack3', kind: 'ammo', title: '买 3 个圈', blurb: '立刻补 3 个圈', cost: 16, rings: 3 },
  { id: 'pack6', kind: 'ammo', title: '买 6 个圈', blurb: '立刻补 6 个圈', cost: 28, rings: 6 },
  { id: 'pack10', kind: 'ammo', title: '整袋圈', blurb: '立刻补 10 个圈', cost: 42, rings: 10 },
  { id: 'duo', kind: 'weapon', title: '双子圈', blurb: '之后每次扔出 2 个圈', cost: 18, throwCount: 2 },
  { id: 'trio', kind: 'weapon', title: '三连星', blurb: '之后每次扔出 3 个圈', cost: 32, throwCount: 3 },
  { id: 'penta', kind: 'weapon', title: '五连珠', blurb: '之后每次扔出 5 个圈', cost: 52, throwCount: 5 },
  { id: 'fan2', kind: 'weapon', title: '双子散射', blurb: '两个圈左右分开飞，各套一边', cost: 22, fan: 0.26, need: { throwCount: 2 } },
  { id: 'fan3', kind: 'weapon', title: '三连散射', blurb: '三个圈扇开，覆盖整排鹅', cost: 30, fan: 0.34, need: { throwCount: 3 } },
  { id: 'fan5', kind: 'weapon', title: '天女散花', blurb: '五个圈大扇面铺开', cost: 40, fan: 0.42, need: { throwCount: 5 } },
  { id: 'pitchfan', kind: 'weapon', title: '远近开弓', blurb: '圈分高低飞，前后排都能套', cost: 26, pitchFan: 0.09, need: { throwCount: 2 } },
  { id: 'goldx2', kind: 'buff', title: '金币潮', blurb: '之后套中金币 ×2', cost: 22, coinMul: 2 },
  { id: 'goldx3', kind: 'buff', title: '夜市暴利', blurb: '之后套中金币 ×3', cost: 40, coinMul: 3, need: { coinMul: 2 } },
  { id: 'jackpot', kind: 'buff', title: '金色暴击', blurb: '金币再 ×5', cost: 55, nextBonus: 5, need: { coinMul: 3 } },
  { id: 'big', kind: 'buff', title: '宽松套', blurb: '圈孔变宽，更好套', cost: 20, slack: 0.035 },
  { id: 'magnet', kind: 'buff', title: '磁铁圈', blurb: '圈会轻轻吸向最近的鹅', cost: 24, magnet: 0.55 },
  { id: 'freeze', kind: 'buff', title: '急冻鹅', blurb: '买下后鹅愣住一段时间', cost: 18, freeze: 18 },
  { id: 'noduck', kind: 'buff', title: '呆头鹅', blurb: '鹅不会缩头躲圈', cost: 20, noDuck: true },
  { id: 'slow', kind: 'buff', title: '慢镜头', blurb: '鹅走得又慢又稳', cost: 16, slowMul: 0.45 },
  { id: 'sticky', kind: 'buff', title: '粘粘圈', blurb: '套上后更不容易弹开', cost: 18, sticky: true },
  { id: 'luck10', kind: 'buff', title: '小运气', blurb: '套中后有 10% 概率获得 2 个圈', cost: 14, doubleChance: 0.10 },
  { id: 'luck20', kind: 'buff', title: '好运连连', blurb: '套中后有 20% 概率获得 2 个圈', cost: 22, doubleChance: 0.20 },
  { id: 'luck30', kind: 'buff', title: '鸿运当头', blurb: '套中后有 30% 概率获得 2 个圈', cost: 32, doubleChance: 0.30 },
  { id: 'dual', kind: 'buff', title: '一圈双鹅', blurb: '一个圈可以同时套两只', cost: 28, dual: true },
  { id: 'back', kind: 'buff', title: '后排专家', blurb: '后排鹅金币 +80%', cost: 16, backBonus: 1.8 },
  { id: 'misssave', kind: 'buff', title: '没中也还你', blurb: '每扔一次，没中把圈还你', cost: 22, keepMissSave: true },
  { id: 'aoe', kind: 'buff', title: '爆竹圈', blurb: '套中时波及身旁的鹅', cost: 30, aoe: true },
  { id: 'light', kind: 'buff', title: '轻飘圈', blurb: '出手更远更好控', cost: 14, light: true },
  { id: 'streak', kind: 'buff', title: '连套狂热', blurb: '连续套中金币越来越高', cost: 18, streakOn: true },
  { id: 'charm', kind: 'buff', title: '护身符', blurb: '圈用完再白给 3 个', cost: 24, charm: true },
  { id: 'mul', kind: 'buff', title: '永久翻倍', blurb: '金币再永久 ×2', cost: 44, persistMul: 2, need: { coinMul: 2 } },
  { id: 'magnet2', kind: 'buff', title: '电磁圈', blurb: '磁力更强，更容易把鹅吸进圈', cost: 32, magnet: 1.2, need: { magnet: true } },
  { id: 'slack2', kind: 'buff', title: '海碗套', blurb: '圈孔再放宽一圈', cost: 28, slack: 0.06, need: { slack: true } },
  { id: 'dual3', kind: 'buff', title: '一圈三鹅', blurb: '一个圈最多同时套三只', cost: 36, dualMax: 3, need: { dual: true } },
  { id: 'aoe2', kind: 'buff', title: '大爆竹', blurb: '套中波及更远、更多鹅', cost: 38, aoeR: 0.72, aoeN: 4, need: { aoe: true } },
  { id: 'streak2', kind: 'buff', title: '连套宗师', blurb: '连套金币涨得更快', cost: 28, streakRate: 0.55, need: { streakOn: true } },
  { id: 'back2', kind: 'buff', title: '后排宗师', blurb: '后排鹅金币再翻倍', cost: 24, backBonus: 2.6, need: { backBonus: true } },
  { id: 'light2', kind: 'buff', title: '神投手', blurb: '出手更远更稳', cost: 22, lightBoost: 1.8, need: { light: true } },
  { id: 'ice2', kind: 'buff', title: '急冻加时', blurb: '鹅愣住更久', cost: 22, freeze: 28, need: { owned: 'freeze' } },
  { id: 'charm2', kind: 'buff', title: '大护身符', blurb: '圈用完再白给 6 个', cost: 34, charm: true, charmN: 6, need: { owned: 'charm' } },
  { id: 'nowind', kind: 'buff', title: '定风珠', blurb: '之后圈不再被风吹歪', cost: 20, noWind: true },
  { id: 'sale', kind: 'buff', title: '夜市打折', blurb: '下次进店全部半价', cost: 14, nextSale: 0.5 },
]

function pickOne(list, prev) {
  const pool = list.filter((s) => s.id !== prev)
  const src = pool.length ? pool : list
  return src[Math.floor(Math.random() * src.length)]
}

export function pickEndlessRound(prevLevel) {
  return { levelCard: pickOne(CAMPAIGN, prevLevel) }
}

export function applyEndlessRound(run, round) {
  const { levelCard } = round
  run.lastLevel = levelCard.id
  run.lastStyle = levelCard.id
  run.styleTitle = levelCard.title
  run.styleBlurb = levelCard.blurb
  const base = LEVELS.find((l) => l.id === levelCard.level) || LEVELS[0]
  return { base }
}

export function weaponLabel(run) {
  const n = run.throwCount || 1
  if (run.fan) {
    if (n >= 5) return '天女散花'
    if (n >= 3) return '三连散射'
    if (n >= 2) return '双子散射'
  }
  if (run.pitchFan && n >= 2) return '远近开弓'
  if (n >= 5) return '五连珠'
  if (n >= 3) return '三连星'
  if (n >= 2) return '双子圈'
  return '单发'
}

export function coinFor(p, run) {
  const table = { gosling: 8, goose: 12, gander: 18, boss: 25 }
  const base = p.score >= 1200 ? 28 : p.score >= 1000 ? 22 : (table[p.kind] || 10)
  const back = (p.z > 3.2 || p.curZ > 3.2) ? run.backBonus : 1
  const streak = run.streakOn ? 1 + run.streak * (run.streakRate || 0.3) : 1
  return Math.max(1, Math.round(base * run.coinMul * run.nextBonus * (run.persistMul || 1) * back * streak))
}

function hasNeed(run, need) {
  if (!need) return true
  if (need.throwCount && (run.throwCount || 1) < need.throwCount) return false
  if (need.coinMul && (run.coinMul || 1) < need.coinMul) return false
  if (need.magnet && !(run.magnet > 0)) return false
  if (need.dual && !run.dual && (run.dualMax || 1) < 2) return false
  if (need.aoe && !run.aoe) return false
  if (need.streakOn && !run.streakOn) return false
  if (need.slack && !(run.slack > 0)) return false
  if (need.fan && !(run.fan > 0)) return false
  if (need.backBonus && (run.backBonus || 1) <= 1) return false
  if (need.light && !run.light) return false
  if (need.owned && !(run.owned || []).includes(need.owned)) return false
  return true
}

export function canOffer(run, item) {
  if (!hasNeed(run, item.need)) return false
  if (item.kind === 'ammo' || item.freeze) return true
  if (item.throwCount) return (run.throwCount || 1) < item.throwCount
  if (item.fan) return (run.fan || 0) < item.fan
  if (item.pitchFan) return (run.pitchFan || 0) < item.pitchFan
  if (item.coinMul) return (run.coinMul || 1) < item.coinMul
  if (item.nextBonus) return (run.nextBonus || 1) < item.nextBonus
  if (item.persistMul) return (run.persistMul || 1) < item.persistMul
  if (item.charmN) return (run.charmN || 3) < item.charmN || !run.charm
  if (item.charm) return !run.charm
  if (item.slack) return (run.slack || 0) < item.slack
  if (item.magnet) return (run.magnet || 0) < item.magnet
  if (item.noDuck) return !run.noDuck
  if (item.slowMul) return (run.slowMul || 1) >= 1
  if (item.sticky) return !run.sticky
  if (item.doubleChance) return (run.doubleRingChance || 0) < item.doubleChance
  if (item.dualMax) return (run.dualMax || (run.dual ? 2 : 1)) < item.dualMax
  if (item.dual) return !run.dual && (run.dualMax || 1) < 2
  if (item.backBonus) return (run.backBonus || 1) < item.backBonus
  if (item.keepMissSave) return !run.keepMissSave
  if (item.aoeR) return (run.aoeR || 0) < item.aoeR
  if (item.aoe) return !run.aoe
  if (item.lightBoost) return !!run.light && (run.lightBoost || 1) < item.lightBoost
  if (item.light) return !run.light
  if (item.streakRate) return !!run.streakOn && (run.streakRate || 0.3) < item.streakRate
  if (item.streakOn) return !run.streakOn
  if (item.noWind) return !run.noWind
  if (item.nextSale) return !(run.owned || []).includes(item.id)
  return !(run.owned || []).includes(item.id)
}

function takeRandom(list, picked) {
  const left = list.filter((s) => !picked.includes(s))
  if (!left.length) return
  picked.push(left[Math.floor(Math.random() * left.length)])
}

function takeFavored(list, picked) {
  const left = list.filter((s) => !picked.includes(s))
  if (!left.length) return
  const gated = left.filter((s) => s.need)
  const pool = gated.length && Math.random() < 0.7 ? gated : left
  picked.push(pool[Math.floor(Math.random() * pool.length)])
}

export function pickShop(run, lastChance = false) {
  const sale = run.sale || 1
  const available = SHOP.filter((s) => canOffer(run, s))
  const packs = available.filter((s) => s.kind === 'ammo')
  const weapons = available.filter((s) => s.kind === 'weapon')
  const buffs = available.filter((s) => s.kind === 'buff')
  const picked = []
  if (lastChance || Math.random() < 0.9) takeRandom(packs, picked)
  takeFavored(weapons, picked)
  takeFavored(buffs, picked)
  takeFavored(buffs, picked)
  while (picked.length < 3) takeRandom(available, picked)
  return picked.slice(0, 4).map((s) => ({ ...s, cost: Math.max(6, Math.round(s.cost * sale)) }))
}

export function applyShopItem(run, item, simT = 0) {
  if (run.coins < item.cost) return false
  run.coins -= item.cost
  if (!run.owned.includes(item.id)) run.owned.push(item.id)
  if (item.rings) run._ringsGain = (run._ringsGain || 0) + item.rings
  if (item.throwCount) run.throwCount = Math.max(run.throwCount || 1, item.throwCount)
  if (item.fan) run.fan = Math.max(run.fan || 0, item.fan)
  if (item.pitchFan) run.pitchFan = Math.max(run.pitchFan || 0, item.pitchFan)
  if (item.coinMul) run.coinMul = Math.max(run.coinMul || 1, item.coinMul)
  if (item.slack) run.slack = Math.max(run.slack || 0, item.slack)
  if (item.magnet) run.magnet = Math.max(run.magnet || 0, item.magnet)
  if (item.freeze) run.freezeUntil = simT + item.freeze
  if (item.noDuck) run.noDuck = true
  if (item.slowMul) run.slowMul = item.slowMul
  if (item.sticky) run.sticky = true
  if (item.doubleChance) run.doubleRingChance = Math.max(run.doubleRingChance || 0, item.doubleChance)
  if (item.dual) {
    run.dual = true
    run.dualMax = Math.max(run.dualMax || 1, 2)
  }
  if (item.dualMax) {
    run.dual = true
    run.dualMax = Math.max(run.dualMax || 1, item.dualMax)
  }
  if (item.backBonus) run.backBonus = Math.max(run.backBonus || 1, item.backBonus)
  if (item.nextBonus) run.nextBonus = Math.max(run.nextBonus || 1, item.nextBonus)
  if (item.keepMissSave) {
    run.keepMissSave = true
    run.missSave = 1
  }
  if (item.aoe) {
    run.aoe = true
    run.aoeR = Math.max(run.aoeR || 0, 0.42)
    run.aoeN = Math.max(run.aoeN || 0, 2)
  }
  if (item.aoeR) {
    run.aoe = true
    run.aoeR = Math.max(run.aoeR || 0, item.aoeR)
    run.aoeN = Math.max(run.aoeN || 0, item.aoeN || 4)
  }
  if (item.light) run.light = true
  if (item.lightBoost) {
    run.light = true
    run.lightBoost = Math.max(run.lightBoost || 1, item.lightBoost)
  }
  if (item.streakOn) run.streakOn = true
  if (item.streakRate) {
    run.streakOn = true
    run.streakRate = Math.max(run.streakRate || 0.3, item.streakRate)
  }
  if (item.persistMul) run.persistMul = Math.max(run.persistMul || 1, item.persistMul)
  if (item.charm) run.charm = true
  if (item.charmN) run.charmN = Math.max(run.charmN || 3, item.charmN)
  if (item.noWind) run.noWind = true
  run.sale = item.nextSale || 1
  return true
}
