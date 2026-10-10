export const SAVE_KEY = 'jiumao-idle-tank-v1'
export const TICK_MS = 1000
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
export const FEED_DURATION = 45
export const FEED_COOLDOWN = 180
export const FEED_MULT = 1.4
export const BUBBLE_LIFE = 12
export const TAP_YIELD_SEC = 12
export const SATED_MS = 45 * 60 * 1000
export const CHEST_GAP_MS = 4 * 60 * 1000
export const CHEST_CHANCE = 0.00055
export const RATE_MULT = 1.55

export const RARITIES = ['common', 'fine', 'rare', 'epic', 'legend', 'myth']

/** 生物类别数值标签。0 鱼类（游动），1 甲壳类（贴底爬行）。以后可继续加。 */
export const LIFE = {
  FISH: 0,
  CRUSTACEAN: 1,
}

/** 粮的种类。0 普通鱼粮；1 甲壳沉底粮（以后单独做）。 */
export const FOOD = {
  FLAKE: 0,
  WAFER: 1,
}

export function lifeOf(spec) {
  const n = Number(spec?.life)
  return Number.isFinite(n) ? n : LIFE.FISH
}

export function isCrustacean(spec) {
  return lifeOf(spec) === LIFE.CRUSTACEAN
}

export const FRY_PACKS = [
  {
    id: 'common',
    price: 28,
    unlock: 1,
    preview: 'linear-gradient(160deg,#d7e0e6,#8aa0ad)',
    icon: '/tank/packs/common.png',
    weights: { common: 82, fine: 14, rare: 3.4, epic: 0.5, legend: 0.1 },
  },
  {
    id: 'fine',
    price: 64,
    unlock: 1,
    preview: 'linear-gradient(160deg,#c8f0d8,#3d8f6a)',
    icon: '/tank/packs/fine.png',
    weights: { common: 36, fine: 42, rare: 16, epic: 5, legend: 1 },
  },
  {
    id: 'rare',
    price: 140,
    unlock: 2,
    preview: 'linear-gradient(160deg,#c8dcff,#3a62c8)',
    icon: '/tank/packs/rare.png',
    weights: { common: 8, fine: 24, rare: 42, epic: 20, legend: 6 },
  },
  {
    id: 'epic',
    price: 2400,
    unlock: 4,
    preview: 'linear-gradient(160deg,#e4c8ff,#7a3cb8)',
    icon: '/tank/packs/epic.png',
    weights: { fine: 8, rare: 24, epic: 48, legend: 20 },
  },
  {
    id: 'legend',
    price: 8800,
    unlock: 6,
    preview: 'linear-gradient(160deg,#ffe7a8,#d4a017)',
    icon: '/tank/packs/legend.png',
    weights: { rare: 15, epic: 62, legend: 23 },
  },
  {
    id: 'myth',
    price: 0,
    unlock: 1,
    shop: false,
    preview: 'linear-gradient(160deg,#ffd0e8,#c43a6e)',
    icon: '/tank/packs/myth.png',
    weights: { epic: 8, legend: 32, myth: 60 },
  },
]

export const SHOP_PACKS = FRY_PACKS.filter((pack) => pack.shop !== false)

const CHEST_FRY_COMMON = [
  [0.36, 'common'],
  [0.18, 'fine'],
  [0.10, 'rare'],
  [0.045, 'epic'],
  [0.014, 'legend'],
  [0.004, 'myth'],
]

const CHEST_FRY_RARE = [
  [0.10, 'common'],
  [0.22, 'fine'],
  [0.26, 'rare'],
  [0.22, 'epic'],
  [0.15, 'legend'],
  [0.05, 'myth'],
]

export const LIGHTS = [
  {
    id: 'sky',
    price: 1200,
    unlock: 1,
    tint: [255, 250, 236],
    tintA: 0.16,
    tintMode: 'overlay',
    dark: 0,
    preview: 'linear-gradient(180deg,#f7f3e4 0%,#9ad0e8 42%,#1d5c86 100%)',
  },
  {
    id: 'warm',
    price: 2400,
    unlock: 2,
    tint: [255, 156, 64],
    tintA: 0.22,
    tintMode: 'multiply',
    dark: 0.1,
    preview: 'linear-gradient(180deg,#ffd08a 0%,#e07a3a 45%,#5a2a18 100%)',
  },
  {
    id: 'moon',
    price: 3600,
    unlock: 2,
    tint: [70, 110, 190],
    tintA: 0.24,
    tintMode: 'multiply',
    dark: 0.46,
    preview: 'linear-gradient(180deg,#1a2744 0%,#243a68 50%,#0b1220 100%)',
  },
  {
    id: 'plant',
    price: 5800,
    unlock: 3,
    tint: [255, 120, 190],
    tintA: 0.12,
    tintMode: 'overlay',
    dark: 0.06,
    preview: 'linear-gradient(180deg,#ff9ad0 0%,#5ee0c8 48%,#173b3a 100%)',
  },
  {
    id: 'reef',
    price: 9600,
    unlock: 4,
    tint: [40, 90, 220],
    tintA: 0.22,
    tintMode: 'multiply',
    dark: 0.18,
    preview: 'linear-gradient(180deg,#7ec8ff 0%,#1d4ea8 48%,#081830 100%)',
  },
  {
    id: 'flow',
    price: 7200,
    unlock: 3,
    tint: [220, 238, 255],
    tintA: 0.12,
    tintMode: 'overlay',
    dark: 0,
    preview: 'linear-gradient(180deg,#eef8ff 0%,#7ec4e8 40%,#1a4d6e 100%)',
  },
]

export const TAGS = {
  plants: { icon: '🌿', label: '绿植' },
  hide: { icon: '🪨', label: '藏身' },
  sparkle: { icon: '✨', label: '亮晶晶' },
}

export const TRAITS = {
  school: { label: '群游', hint: '同种满 3 条时每条 +8%' },
  solo: { label: '独游', hint: '缸内没有同种时 +12%' },
  explore: { label: '探索', hint: '每种布景标签 +4%' },
}

export const FISH = [
  { id: 'guppy', name: '孔雀鱼', src: '/tank/fish/guppy.png', price: 18, rate: 0.018, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 1, face: -1, size: 58 },
  { id: 'tetra', name: '霓虹灯鱼', src: '/tank/fish/tetra.png', price: 28, rate: 0.022, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 1, face: -1, size: 54 },
  { id: 'zebra', name: '斑马鱼', src: '/tank/fish/zebra.png', price: 72, rate: 0.028, layer: 'mid', trait: 'explore', prefer: 'hide', unlock: 2, face: -1, size: 62 },
  { id: 'clown', name: '小丑鱼', src: '/tank/fish/clown.png', price: 120, rate: 0.034, layer: 'mid', trait: 'school', prefer: 'hide', unlock: 2, face: -1, size: 64 },
  { id: 'betta', name: '斗鱼', src: '/tank/fish/betta.png', price: 210, rate: 0.042, layer: 'mid', trait: 'solo', prefer: 'sparkle', unlock: 3, face: -1, size: 70 },
  { id: 'angel', name: '神仙鱼', src: '/tank/fish/angel.png', price: 360, rate: 0.052, layer: 'upper', trait: 'explore', prefer: 'plants', unlock: 4, face: 1, size: 78 },
  { id: 'pleco', name: '清道夫', src: '/tank/fish/pleco.png', price: 580, rate: 0.064, layer: 'bottom', trait: 'solo', prefer: 'hide', unlock: 5, face: -1, size: 76 },
  { id: 'puffer', name: '河豚', src: '/tank/fish/puffer.png', price: 920, rate: 0.078, layer: 'mid', trait: 'explore', prefer: 'sparkle', unlock: 6, face: -1, size: 72 },
  { id: 'horse', name: '海马', src: '/tank/fish/horse.png', price: 1480, rate: 0.094, layer: 'mid', trait: 'solo', prefer: 'plants', unlock: 7, face: -1, size: 68 },
  { id: 'jelly', name: '月光水母', src: '/tank/fish/jelly.png', price: 2300, rate: 0.112, layer: 'upper', trait: 'explore', prefer: 'sparkle', unlock: 8, face: -1, size: 74 },
  { id: 'angler', name: '灯笼鮟鱇', src: '/tank/fish/pack-00.png', price: 42, rate: 0.018, layer: 'bottom', trait: 'school', prefer: 'plants', unlock: 1, face: -1, size: 72 },
  { id: 'discus', name: '蓝方鲀', src: '/tank/fish/pack-01.png', price: 63, rate: 0.019, layer: 'upper', trait: 'school', prefer: 'hide', unlock: 1, face: -1, size: 78 },
  { id: 'ytang', name: '尖嘴鱼', src: '/tank/fish/pack-02.png', price: 85, rate: 0.021, layer: 'mid', trait: 'explore', prefer: 'sparkle', unlock: 1, face: -1, size: 64 },
  { id: 'spike', name: '刺球豚', src: '/tank/fish/pack-03.png', price: 110, rate: 0.022, layer: 'mid', trait: 'solo', prefer: 'plants', unlock: 1, face: -1, size: 70 },
  { id: 'moonfly', name: '紫吊', src: '/tank/fish/pack-04.png', price: 136, rate: 0.024, layer: 'mid', trait: 'school', prefer: 'hide', unlock: 1, face: -1, size: 62 },
  { id: 'lion', name: '蓑鲉', src: '/tank/fish/pack-05.png', price: 163, rate: 0.025, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 2, face: -1, size: 76 },
  { id: 'ghorse', name: '翠海马', src: '/tank/fish/pack-06.png', price: 193, rate: 0.026, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 2, face: -1, size: 66 },
  { id: 'bubble', name: '金刺豚', src: '/tank/fish/pack-07.png', price: 224, rate: 0.028, layer: 'mid', trait: 'explore', prefer: 'hide', unlock: 2, face: -1, size: 68 },
  { id: 'wrasse', name: '粉鳍鱼', src: '/tank/fish/pack-08.png', price: 256, rate: 0.029, layer: 'mid', trait: 'solo', prefer: 'sparkle', unlock: 2, face: -1, size: 64 },
  { id: 'fireangel', name: '火焰神仙', src: '/tank/fish/pack-10.png', price: 327, rate: 0.032, layer: 'upper', trait: 'school', prefer: 'hide', unlock: 3, face: -1, size: 76 },
  { id: 'goby', name: '青苔虾虎', src: '/tank/fish/pack-11.png', price: 365, rate: 0.033, layer: 'bottom', trait: 'school', prefer: 'sparkle', unlock: 3, face: -1, size: 58 },
  { id: 'psnap', name: '七彩盘鱼', src: '/tank/fish/pack-12.png', price: 404, rate: 0.035, layer: 'mid', trait: 'explore', prefer: 'plants', unlock: 3, face: -1, size: 66 },
  { id: 'goldstripe', name: '金条纹', src: '/tank/fish/pack-13.png', price: 446, rate: 0.036, layer: 'mid', trait: 'solo', prefer: 'hide', unlock: 3, face: -1, size: 60 },
  { id: 'bdevil', name: '黑魔鬼', src: '/tank/fish/pack-14.png', price: 489, rate: 0.038, layer: 'bottom', trait: 'school', prefer: 'sparkle', unlock: 3, face: -1, size: 72 },
  { id: 'ohorse', name: '橙海马', src: '/tank/fish/pack-15.png', price: 533, rate: 0.039, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 4, face: -1, size: 66 },
  { id: 'pearlpu', name: '珍珠鲀', src: '/tank/fish/pack-16.png', price: 580, rate: 0.04, layer: 'mid', trait: 'school', prefer: 'hide', unlock: 4, face: -1, size: 70 },
  { id: 'redlion', name: '红狮子', src: '/tank/fish/pack-17.png', price: 628, rate: 0.042, layer: 'mid', trait: 'explore', prefer: 'sparkle', unlock: 4, face: -1, size: 76 },
  { id: 'silverbelt', name: '银带鱼', src: '/tank/fish/pack-18.png', price: 677, rate: 0.043, layer: 'mid', trait: 'solo', prefer: 'plants', unlock: 4, face: -1, size: 62 },
  { id: 'jadecarp', name: '碧波鲤', src: '/tank/fish/pack-19.png', price: 729, rate: 0.045, layer: 'mid', trait: 'school', prefer: 'hide', unlock: 4, face: -1, size: 68 },
  { id: 'damsel', name: '珊瑚雀', src: '/tank/fish/pack-20.png', price: 782, rate: 0.046, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 5, face: -1, size: 56 },
  { id: 'peel', name: '紫电鳗', src: '/tank/fish/pack-21.png', price: 837, rate: 0.047, layer: 'bottom', trait: 'school', prefer: 'plants', unlock: 5, face: -1, size: 80 },
  { id: 'starfly', name: '星点蝶', src: '/tank/fish/pack-22.png', price: 893, rate: 0.049, layer: 'mid', trait: 'explore', prefer: 'hide', unlock: 5, face: -1, size: 62 },
  { id: 'lemon', name: '柠檬鱼', src: '/tank/fish/pack-23.png', price: 952, rate: 0.05, layer: 'mid', trait: 'solo', prefer: 'sparkle', unlock: 5, face: -1, size: 58 },
  { id: 'inkcat', name: '墨玉鲶', src: '/tank/fish/pack-24.png', price: 1012, rate: 0.052, layer: 'bottom', trait: 'school', prefer: 'plants', unlock: 5, face: -1, size: 74 },
  { id: 'pinkangel', name: '粉神仙', src: '/tank/fish/pack-25.png', price: 1073, rate: 0.053, layer: 'upper', trait: 'school', prefer: 'hide', unlock: 6, face: -1, size: 76 },
  { id: 'yhorse', name: '黄海马', src: '/tank/fish/pack-26.png', price: 1137, rate: 0.054, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 6, face: -1, size: 66 },
  { id: 'tigerw', name: '虎纹龙', src: '/tank/fish/pack-27.png', price: 1202, rate: 0.056, layer: 'mid', trait: 'explore', prefer: 'plants', unlock: 6, face: -1, size: 64 },
  { id: 'bluepu', name: '蓝泡豚', src: '/tank/fish/pack-28.png', price: 1268, rate: 0.057, layer: 'mid', trait: 'solo', prefer: 'hide', unlock: 6, face: -1, size: 70 },
  { id: 'redflame', name: '赤焰鲷', src: '/tank/fish/pack-29.png', price: 1337, rate: 0.059, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 6, face: -1, size: 66 },
  { id: 'gdragon', name: '青龙鱼', src: '/tank/fish/pack-30.png', price: 1407, rate: 0.06, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 7, face: -1, size: 78 },
  { id: 'snowfl', name: '雪花鲽', src: '/tank/fish/pack-31.png', price: 1479, rate: 0.061, layer: 'bottom', trait: 'school', prefer: 'hide', unlock: 7, face: -1, size: 68 },
  { id: 'phorse', name: '紫海马', src: '/tank/fish/pack-32.png', price: 1552, rate: 0.063, layer: 'mid', trait: 'explore', prefer: 'sparkle', unlock: 7, face: -1, size: 66 },
  { id: 'goldray', name: '黄金魟', src: '/tank/fish/pack-33.png', price: 1628, rate: 0.064, layer: 'bottom', trait: 'solo', prefer: 'plants', unlock: 7, face: -1, size: 80 },
  { id: 'deepang', name: '深海鮟鱇', src: '/tank/fish/pack-34.png', price: 1705, rate: 0.066, layer: 'bottom', trait: 'school', prefer: 'hide', unlock: 7, face: -1, size: 74 },
  { id: 'rainbowk', name: '彩虹鳉', src: '/tank/fish/pack-35.png', price: 1783, rate: 0.067, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 8, face: -1, size: 54 },
  { id: 'grouper', name: '石斑仔', src: '/tank/fish/pack-36.png', price: 1864, rate: 0.068, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 8, face: -1, size: 70 },
  { id: 'geel', name: '绿毛鳗', src: '/tank/fish/pack-37.png', price: 1946, rate: 0.07, layer: 'bottom', trait: 'explore', prefer: 'hide', unlock: 8, face: -1, size: 80 },
  { id: 'rhorse', name: '红海马', src: '/tank/fish/pack-38.png', price: 2029, rate: 0.071, layer: 'mid', trait: 'solo', prefer: 'sparkle', unlock: 8, face: -1, size: 66 },
  { id: 'moonpu', name: '月光魨', src: '/tank/fish/pack-39.png', price: 2115, rate: 0.073, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 8, face: -1, size: 70 },
  { id: 'bluelion', name: '蓝狮', src: '/tank/fish/pack-40.png', price: 2202, rate: 0.074, layer: 'mid', trait: 'school', prefer: 'hide', unlock: 9, face: -1, size: 76 },
  { id: 'koi', name: '锦鲤仙', src: '/tank/fish/pack-41.png', price: 2291, rate: 0.075, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 9, face: -1, size: 72 },
  { id: 'crystal', name: '紫晶蝶', src: '/tank/fish/pack-42.png', price: 2381, rate: 0.077, layer: 'upper', trait: 'explore', prefer: 'plants', unlock: 9, face: -1, size: 64 },
  { id: 'sandcat', name: '沙底鲶', src: '/tank/fish/pack-43.png', price: 2474, rate: 0.078, layer: 'bottom', trait: 'solo', prefer: 'hide', unlock: 9, face: -1, size: 72 },
  { id: 'flametail', name: '焰尾鱼', src: '/tank/fish/pack-44.png', price: 2568, rate: 0.08, layer: 'mid', trait: 'school', prefer: 'sparkle', unlock: 9, face: -1, size: 62 },
  { id: 'jadehorse', name: '碧海马', src: '/tank/fish/pack-45.png', price: 2663, rate: 0.081, layer: 'mid', trait: 'school', prefer: 'plants', unlock: 10, face: -1, size: 66 },
  { id: 'spotpu', name: '斑点鲀', src: '/tank/fish/pack-46.png', price: 2761, rate: 0.082, layer: 'mid', trait: 'school', prefer: 'hide', unlock: 10, face: -1, size: 68 },
  { id: 'silverar', name: '银龙鱼', src: '/tank/fish/pack-47.png', price: 2860, rate: 0.084, layer: 'mid', trait: 'explore', prefer: 'sparkle', unlock: 10, face: -1, size: 80 },
  { id: 'coraleel', name: '珊瑚鳗', src: '/tank/fish/pack-48.png', price: 2960, rate: 0.085, layer: 'bottom', trait: 'solo', prefer: 'plants', unlock: 10, face: -1, size: 78 },
  { id: 'stara', name: '星海神仙', src: '/tank/fish/pack-49.png', price: 3063, rate: 0.087, layer: 'upper', trait: 'school', prefer: 'hide', unlock: 10, face: -1, size: 76 },
]

export const DECOR = [
  { id: 'weed-a', name: '海带丛', src: '/tank/decor/weed-a.png', price: 55, tag: 'plants', unlock: 1, size: 148 },
  { id: 'weed-b', name: '摇曳水草', src: '/tank/decor/weed-b.png', price: 70, tag: 'plants', unlock: 1, size: 142 },
  { id: 'moss', name: '苔藓球', src: '/tank/decor/moss.png', price: 88, tag: 'plants', unlock: 2, size: 96 },
  { id: 'pearl', name: '珍珠蚌', src: '/tank/decor/pearl.png', price: 95, tag: 'sparkle', unlock: 2, size: 118 },
  { id: 'castle', name: '石堡', src: '/tank/decor/castle.png', price: 110, tag: 'hide', unlock: 1, size: 220, tunnel: { mx: 0.50, my: 0.80, hw: 0.13, hh: 0.10 } },
  { id: 'cave', name: '石洞', src: '/tank/decor/cave.png', price: 135, tag: 'hide', unlock: 2, size: 200, den: { mx: 0.50, my: 0.60, hw: 0.18, hh: 0.16 } },
  { id: 'coral', name: '珊瑚丛', src: '/tank/decor/coral.png', price: 155, tag: 'sparkle', unlock: 3, size: 188 },
  { id: 'arch', name: '石拱门', src: '/tank/decor/arch.png', price: 175, tag: 'hide', unlock: 3, size: 176, tunnel: { mx: 0.50, my: 0.55, hw: 0.22, hh: 0.20 } },
]

export const TANKS = [
  {
    id: 0,
    key: 'vale',
    name: '溪谷水草',
    fish: 4,
    price: 0,
    unlock: 1,
    bg: '/tank/scenes/vale.png',
    cover: '/tank/scenes/vale.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'rock-l', kind: 'solid', tag: 'hide', x: 0.18, y: 0.74, halfW: 0.08, halfH: 0.10 },
      { id: 'plants-l', kind: 'soft', tag: 'plants', x: 0.20, y: 0.52, halfW: 0.07, halfH: 0.14 },
      { id: 'bush-l', kind: 'soft', tag: 'plants', x: 0.22, y: 0.84, halfW: 0.06, halfH: 0.06 },
      { id: 'path', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.78, halfW: 0.10, halfH: 0.08 },
      { id: 'rays', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.36, halfW: 0.08, halfH: 0.10 },
      { id: 'rock-r', kind: 'solid', tag: 'hide', x: 0.80, y: 0.74, halfW: 0.08, halfH: 0.10 },
      { id: 'plants-r', kind: 'soft', tag: 'plants', x: 0.82, y: 0.54, halfW: 0.07, halfH: 0.14 },
      { id: 'den', kind: 'den', tag: 'hide', x: 0.78, y: 0.84, halfW: 0.06, halfH: 0.05 },
    ],
  },
  {
    id: 12,
    key: 'egypt',
    name: '金沙神殿',
    fish: 5,
    price: 2400,
    unlock: 1,
    bg: '/tank/scenes/egypt.png',
    cover: '/tank/scenes/egypt.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'chest', kind: 'solid', tag: 'sparkle', x: 0.16, y: 0.82, halfW: 0.07, halfH: 0.07 },
      { id: 'plants-l', kind: 'soft', tag: 'plants', x: 0.22, y: 0.68, halfW: 0.06, halfH: 0.10 },
      { id: 'pharaoh', kind: 'solid', tag: 'hide', x: 0.48, y: 0.62, halfW: 0.10, halfH: 0.16 },
      { id: 'throne', kind: 'den', tag: 'hide', x: 0.50, y: 0.84, halfW: 0.08, halfH: 0.06 },
      { id: 'rays', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.32, halfW: 0.08, halfH: 0.10 },
      { id: 'anubis', kind: 'solid', tag: 'hide', x: 0.78, y: 0.70, halfW: 0.08, halfH: 0.10 },
      { id: 'plants-r', kind: 'soft', tag: 'plants', x: 0.86, y: 0.78, halfW: 0.06, halfH: 0.08 },
    ],
  },
  {
    id: 13,
    key: 'bamboo',
    name: '竹林石庭',
    fish: 5,
    price: 3200,
    unlock: 1,
    bg: '/tank/scenes/bamboo.png',
    cover: '/tank/scenes/bamboo.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'basin', kind: 'solid', tag: 'sparkle', x: 0.16, y: 0.78, halfW: 0.06, halfH: 0.08 },
      { id: 'lantern', kind: 'solid', tag: 'sparkle', x: 0.22, y: 0.70, halfW: 0.04, halfH: 0.08 },
      { id: 'bamboo-l', kind: 'soft', tag: 'plants', x: 0.18, y: 0.48, halfW: 0.08, halfH: 0.16 },
      { id: 'path', kind: 'soft', tag: 'sparkle', x: 0.48, y: 0.82, halfW: 0.10, halfH: 0.06 },
      { id: 'pavilion', kind: 'tunnel', tag: 'hide', x: 0.52, y: 0.62, halfW: 0.07, halfH: 0.08 },
      { id: 'arch', kind: 'tunnel', tag: 'hide', x: 0.78, y: 0.62, halfW: 0.08, halfH: 0.12 },
      { id: 'bamboo-r', kind: 'soft', tag: 'plants', x: 0.88, y: 0.50, halfW: 0.06, halfH: 0.16 },
      { id: 'den', kind: 'den', tag: 'hide', x: 0.72, y: 0.84, halfW: 0.06, halfH: 0.05 },
    ],
  },
  {
    id: 2,
    key: 'pavilion',
    name: '亭桥园林',
    fish: 12,
    price: 168000,
    unlock: 4,
    bg: '/tank/scenes/pavilion.png',
    cover: '/tank/scenes/pavilion.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'tree', kind: 'soft', tag: 'plants', x: 0.10, y: 0.70, halfW: 0.06, halfH: 0.10 },
      { id: 'gate', kind: 'tunnel', tag: 'hide', x: 0.20, y: 0.78, halfW: 0.05, halfH: 0.07 },
      { id: 'lantern', kind: 'solid', tag: 'sparkle', x: 0.13, y: 0.86, halfW: 0.035, halfH: 0.05 },
      { id: 'rock', kind: 'den', tag: 'hide', x: 0.48, y: 0.74, halfW: 0.06, halfH: 0.08 },
      { id: 'blossom', kind: 'soft', tag: 'plants', x: 0.62, y: 0.68, halfW: 0.07, halfH: 0.09 },
      { id: 'bridge', kind: 'tunnel', tag: 'hide', x: 0.70, y: 0.80, halfW: 0.06, halfH: 0.06 },
      { id: 'jar', kind: 'den', tag: 'hide', x: 0.86, y: 0.84, halfW: 0.045, halfH: 0.05 },
    ],
  },
  {
    id: 3,
    key: 'fuji',
    name: '樱屋鸟居',
    fish: 6,
    price: 18000,
    unlock: 2,
    bg: '/tank/scenes/fuji.png',
    cover: '/tank/scenes/fuji.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'blossom', kind: 'soft', tag: 'plants', x: 0.16, y: 0.52, halfW: 0.08, halfH: 0.10 },
      { id: 'house', kind: 'solid', tag: 'hide', x: 0.22, y: 0.72, halfW: 0.07, halfH: 0.08 },
      { id: 'lantern', kind: 'solid', tag: 'sparkle', x: 0.18, y: 0.84, halfW: 0.035, halfH: 0.05 },
      { id: 'bridge', kind: 'tunnel', tag: 'hide', x: 0.48, y: 0.78, halfW: 0.06, halfH: 0.06 },
      { id: 'maple', kind: 'soft', tag: 'plants', x: 0.52, y: 0.62, halfW: 0.06, halfH: 0.08 },
      { id: 'torii', kind: 'tunnel', tag: 'hide', x: 0.72, y: 0.68, halfW: 0.06, halfH: 0.08 },
      { id: 'pagoda', kind: 'solid', tag: 'sparkle', x: 0.82, y: 0.72, halfW: 0.05, halfH: 0.10 },
      { id: 'bamboo', kind: 'soft', tag: 'plants', x: 0.90, y: 0.58, halfW: 0.05, halfH: 0.12 },
    ],
  },
  {
    id: 4,
    key: 'torii',
    name: '鸟居红叶',
    fish: 8,
    price: 64000,
    unlock: 3,
    bg: '/tank/scenes/torii.png',
    cover: '/tank/scenes/torii.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'torii', kind: 'tunnel', tag: 'hide', x: 0.18, y: 0.62, halfW: 0.055, halfH: 0.08 },
      { id: 'lantern', kind: 'solid', tag: 'sparkle', x: 0.20, y: 0.82, halfW: 0.04, halfH: 0.06 },
      { id: 'blossom', kind: 'soft', tag: 'plants', x: 0.22, y: 0.88, halfW: 0.06, halfH: 0.05 },
      { id: 'den', kind: 'den', tag: 'hide', x: 0.48, y: 0.72, halfW: 0.06, halfH: 0.08 },
      { id: 'bridge', kind: 'tunnel', tag: 'hide', x: 0.62, y: 0.80, halfW: 0.055, halfH: 0.055 },
      { id: 'maple', kind: 'soft', tag: 'plants', x: 0.70, y: 0.58, halfW: 0.06, halfH: 0.09 },
      { id: 'pagoda', kind: 'solid', tag: 'sparkle', x: 0.78, y: 0.68, halfW: 0.05, halfH: 0.10 },
      { id: 'bamboo', kind: 'soft', tag: 'plants', x: 0.90, y: 0.55, halfW: 0.05, halfH: 0.12 },
    ],
  },
  {
    id: 5,
    key: 'jiangnan',
    name: '江南水乡',
    fish: 10,
    price: 108000,
    unlock: 4,
    bg: '/tank/scenes/jiangnan.png',
    cover: '/tank/scenes/jiangnan.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'house', kind: 'tunnel', tag: 'hide', x: 0.18, y: 0.70, halfW: 0.06, halfH: 0.08 },
      { id: 'lantern', kind: 'solid', tag: 'sparkle', x: 0.28, y: 0.84, halfW: 0.03, halfH: 0.05 },
      { id: 'bridge', kind: 'tunnel', tag: 'hide', x: 0.48, y: 0.78, halfW: 0.07, halfH: 0.07 },
      { id: 'bamboo', kind: 'soft', tag: 'plants', x: 0.58, y: 0.58, halfW: 0.06, halfH: 0.10 },
      { id: 'pavilion', kind: 'tunnel', tag: 'hide', x: 0.78, y: 0.68, halfW: 0.06, halfH: 0.07 },
      { id: 'blossom', kind: 'soft', tag: 'plants', x: 0.82, y: 0.52, halfW: 0.07, halfH: 0.09 },
      { id: 'boat', kind: 'solid', tag: 'sparkle', x: 0.88, y: 0.84, halfW: 0.05, halfH: 0.04 },
    ],
  },
  {
    id: 6,
    key: 'canyon',
    name: '西部沙洲',
    fish: 12,
    price: 240000,
    unlock: 5,
    bg: '/tank/scenes/canyon.png',
    cover: '/tank/scenes/canyon.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'cactus', kind: 'soft', tag: 'plants', x: 0.16, y: 0.62, halfW: 0.06, halfH: 0.12 },
      { id: 'sign', kind: 'solid', tag: 'sparkle', x: 0.18, y: 0.48, halfW: 0.05, halfH: 0.10 },
      { id: 'log', kind: 'den', tag: 'hide', x: 0.42, y: 0.80, halfW: 0.08, halfH: 0.06 },
      { id: 'wood', kind: 'solid', tag: 'hide', x: 0.48, y: 0.58, halfW: 0.07, halfH: 0.08 },
      { id: 'arch', kind: 'tunnel', tag: 'hide', x: 0.68, y: 0.72, halfW: 0.06, halfH: 0.08 },
      { id: 'mill', kind: 'solid', tag: 'sparkle', x: 0.78, y: 0.50, halfW: 0.05, halfH: 0.14 },
      { id: 'weed', kind: 'soft', tag: 'plants', x: 0.88, y: 0.70, halfW: 0.05, halfH: 0.10 },
    ],
  },
  {
    id: 7,
    key: 'jungle',
    name: '雨林飞瀑',
    fish: 14,
    price: 360000,
    unlock: 6,
    bg: '/tank/scenes/jungle.png',
    cover: '/tank/scenes/jungle.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'trunk-l', kind: 'solid', tag: 'hide', x: 0.16, y: 0.55, halfW: 0.07, halfH: 0.16 },
      { id: 'ferns', kind: 'soft', tag: 'plants', x: 0.22, y: 0.78, halfW: 0.07, halfH: 0.08 },
      { id: 'falls', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.48, halfW: 0.08, halfH: 0.14 },
      { id: 'den', kind: 'den', tag: 'hide', x: 0.52, y: 0.78, halfW: 0.07, halfH: 0.07 },
      { id: 'bromeliad', kind: 'soft', tag: 'sparkle', x: 0.62, y: 0.84, halfW: 0.05, halfH: 0.05 },
      { id: 'trunk-r', kind: 'solid', tag: 'hide', x: 0.84, y: 0.52, halfW: 0.07, halfH: 0.16 },
      { id: 'plants-r', kind: 'soft', tag: 'plants', x: 0.80, y: 0.80, halfW: 0.06, halfH: 0.08 },
    ],
  },
  {
    id: 8,
    key: 'ice',
    name: '冰谷雪岭',
    fish: 12,
    price: 420000,
    unlock: 6,
    bg: '/tank/scenes/ice.png',
    cover: '/tank/scenes/ice.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'peak-l', kind: 'solid', tag: 'hide', x: 0.16, y: 0.55, halfW: 0.08, halfH: 0.16 },
      { id: 'ice-l', kind: 'solid', tag: 'sparkle', x: 0.18, y: 0.36, halfW: 0.07, halfH: 0.10 },
      { id: 'path', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.78, halfW: 0.10, halfH: 0.08 },
      { id: 'den', kind: 'den', tag: 'hide', x: 0.48, y: 0.84, halfW: 0.07, halfH: 0.06 },
      { id: 'peak-r', kind: 'solid', tag: 'hide', x: 0.84, y: 0.50, halfW: 0.08, halfH: 0.16 },
      { id: 'ice-r', kind: 'solid', tag: 'sparkle', x: 0.82, y: 0.32, halfW: 0.06, halfH: 0.10 },
      { id: 'weed', kind: 'soft', tag: 'plants', x: 0.70, y: 0.84, halfW: 0.05, halfH: 0.06 },
    ],
  },
  {
    id: 9,
    key: 'grove',
    name: '雾林溪谷',
    fish: 14,
    price: 520000,
    unlock: 6,
    bg: '/tank/scenes/grove.png',
    cover: '/tank/scenes/grove.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'tree-l', kind: 'solid', tag: 'hide', x: 0.16, y: 0.48, halfW: 0.07, halfH: 0.18 },
      { id: 'moss-l', kind: 'soft', tag: 'plants', x: 0.22, y: 0.78, halfW: 0.07, halfH: 0.08 },
      { id: 'rays', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.42, halfW: 0.08, halfH: 0.10 },
      { id: 'path', kind: 'soft', tag: 'sparkle', x: 0.50, y: 0.72, halfW: 0.08, halfH: 0.10 },
      { id: 'log', kind: 'den', tag: 'hide', x: 0.72, y: 0.78, halfW: 0.08, halfH: 0.06 },
      { id: 'tree-r', kind: 'solid', tag: 'hide', x: 0.86, y: 0.50, halfW: 0.07, halfH: 0.16 },
      { id: 'ferns', kind: 'soft', tag: 'plants', x: 0.80, y: 0.80, halfW: 0.06, halfH: 0.08 },
    ],
  },
  {
    id: 10,
    key: 'karst',
    name: '山水亭台',
    fish: 14,
    price: 640000,
    unlock: 7,
    bg: '/tank/scenes/karst.png',
    cover: '/tank/scenes/karst.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'bonsai', kind: 'soft', tag: 'plants', x: 0.12, y: 0.62, halfW: 0.06, halfH: 0.12 },
      { id: 'moss-l', kind: 'soft', tag: 'plants', x: 0.16, y: 0.80, halfW: 0.06, halfH: 0.08 },
      { id: 'bridge', kind: 'tunnel', tag: 'hide', x: 0.50, y: 0.70, halfW: 0.07, halfH: 0.07 },
      { id: 'pavilion', kind: 'tunnel', tag: 'hide', x: 0.72, y: 0.58, halfW: 0.06, halfH: 0.08 },
      { id: 'blossom', kind: 'soft', tag: 'sparkle', x: 0.68, y: 0.52, halfW: 0.05, halfH: 0.08 },
      { id: 'bamboo', kind: 'soft', tag: 'plants', x: 0.90, y: 0.55, halfW: 0.05, halfH: 0.14 },
      { id: 'rock', kind: 'den', tag: 'hide', x: 0.86, y: 0.82, halfW: 0.05, halfH: 0.06 },
    ],
  },
  {
    id: 11,
    key: 'glow',
    name: '深海萤礁',
    fish: 16,
    price: 800000,
    unlock: 7,
    bg: '/tank/scenes/glow.png',
    cover: '/tank/scenes/glow.png',
    tags: ['plants', 'hide', 'sparkle'],
    zones: [
      { id: 'coral-l', kind: 'solid', tag: 'hide', x: 0.16, y: 0.58, halfW: 0.08, halfH: 0.14 },
      { id: 'glow-l', kind: 'soft', tag: 'sparkle', x: 0.20, y: 0.42, halfW: 0.06, halfH: 0.08 },
      { id: 'path', kind: 'soft', tag: 'plants', x: 0.50, y: 0.80, halfW: 0.10, halfH: 0.08 },
      { id: 'den', kind: 'den', tag: 'hide', x: 0.48, y: 0.78, halfW: 0.07, halfH: 0.07 },
      { id: 'coral-r', kind: 'solid', tag: 'hide', x: 0.84, y: 0.55, halfW: 0.08, halfH: 0.14 },
      { id: 'clam', kind: 'solid', tag: 'sparkle', x: 0.82, y: 0.84, halfW: 0.06, halfH: 0.06 },
      { id: 'glow-r', kind: 'soft', tag: 'sparkle', x: 0.78, y: 0.40, halfW: 0.06, halfH: 0.08 },
    ],
  },
]

export const XP_LEVELS = [0, 22, 50, 85, 130, 180, 225, 260, 285, 305]
export const XP_FISH = 5
export const XP_TANK = 10
export const XP_CHEST = 4
export const XP_CHEST_RARE = 10

export function fishById(id) {
  return FISH.find((f) => f.id === id)
}

export function decorById(id) {
  return DECOR.find((d) => d.id === id)
}

export function tankById(id) {
  return TANKS.find((t) => t.id === id) || TANKS[0]
}

export function lightById(id) {
  return LIGHTS.find((l) => l.id === id) || null
}

export function packById(id) {
  return FRY_PACKS.find((p) => p.id === id) || null
}

export function rarityOf(specOrId) {
  const spec = typeof specOrId === 'string' ? fishById(specOrId) : specOrId
  const lv = spec?.unlock || 1
  if (lv >= 10) return 'myth'
  if (lv >= 9) return 'legend'
  if (lv >= 7) return 'epic'
  if (lv >= 5) return 'rare'
  if (lv >= 3) return 'fine'
  return 'common'
}

export function fishOfRarity(rarity) {
  return FISH.filter((f) => rarityOf(f) === rarity)
}

export function formatOdds(n) {
  const t = Math.round(Number(n) * 10) / 10
  return Number.isInteger(t) ? String(t) : t.toFixed(1)
}

function pickWeighted(weights) {
  const entries = Object.entries(weights || {}).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + Number(w), 0)
  if (!entries.length || total <= 0) return RARITIES[0]
  let n = Math.random() * total
  for (const [id, w] of entries) {
    n -= Number(w)
    if (n <= 0) return id
  }
  return entries[entries.length - 1][0]
}

export function rollChestFryPack(tier = 'common') {
  const table = tier === 'rare' ? CHEST_FRY_RARE : CHEST_FRY_COMMON
  let n = Math.random()
  for (const [chance, id] of table) {
    n -= chance
    if (n <= 0) return id
  }
  return null
}

export function rollChestCoins(rare, lv = 1) {
  const level = Math.max(1, Number(lv) || 1)
  const scale = 1 + (level - 1) * 0.28
  const base = rare
    ? 880 + Math.random() * 920
    : 220 + Math.random() * 280
  return Math.max(1, Math.round(base * scale))
}

export function rollPackSpecies(packId = 'common') {
  const pack = packById(packId) || FRY_PACKS[0]
  let rarity = pickWeighted(pack.weights)
  let pool = fishOfRarity(rarity)
  if (!pool.length) {
    const idx = RARITIES.indexOf(rarity)
    for (let i = idx - 1; i >= 0; i--) {
      pool = fishOfRarity(RARITIES[i])
      if (pool.length) break
    }
  }
  const list = pool.length ? pool : FISH
  return list[Math.floor(Math.random() * list.length)].id
}

export function makeStarterFry(now = Date.now()) {
  const species = rollPackSpecies('common')
  const spec = fishById(species)
  return {
    id: uid('f'),
    species,
    x: 0.5,
    y: isCrustacean(spec) ? 0.84 : spec?.layer === 'upper' ? 0.28 : spec?.layer === 'bottom' ? 0.78 : 0.52,
    vx: spec?.face > 0 ? 0.05 : -0.05,
    vy: 0,
    nextBubble: now + 25000,
    happyUntil: 0,
    bornAt: now,
    growBonusMs: 0,
    grownMs: 0,
    lookSeed: (Math.random() * 0xffffffff) >>> 0,
    mystery: true,
    quality: 'common',
    satedUntil: 0,
    entering: true,
  }
}

export function sceneForTank(tankId) {
  const tank = tankById(tankId)
  return (tank.scene || []).map((p, i) => ({
    id: `s-${tank.id}-${i}`,
    decorId: p.decorId,
    x: p.x,
    y: p.y,
  }))
}

export function aquariumLevel(xp) {
  let lv = 1
  for (let i = 1; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i]) lv = i + 1
  }
  return Math.min(10, lv)
}

export function xpIntoLevel(xp) {
  const lv = aquariumLevel(xp)
  const start = XP_LEVELS[lv - 1] || 0
  const next = XP_LEVELS[lv] ?? start + 80
  return { lv, start, next, t: next === start ? 1 : Math.min(1, (xp - start) / (next - start)) }
}

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export function starterState() {
  const now = Date.now()
  return {
    v: 1,
    coins: 0,
    xp: 0,
    tank: 0,
    ownedTanks: [0],
    fish: [makeStarterFry(now)],
    boxed: [],
    placed: sceneForTank(0),
    pack: [],
    albumFish: [],
    albumTanks: [0],
    ownedLights: [],
    light: '',
    chest: null,
    chestReadyAt: 0,
    feedUntil: 0,
    feedReadyAt: 0,
    lastTick: now,
    lastSave: now,
    guide: true,
    starTide: false,
  }
}
