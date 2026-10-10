const PRIZE = {
  gosling: { kind: 'gosling', bodyR: 0.085, neckR: 0.022, neckLen: 0.20, score: 250, react: 0.6, swayAmp: 0.05 },
  goose: { kind: 'goose', bodyR: 0.10, neckR: 0.024, neckLen: 0.26, score: 500, react: 0.9, swayAmp: 0.07 },
  gander: { kind: 'gander', bodyR: 0.115, neckR: 0.026, neckLen: 0.31, score: 800, react: 1.2, swayAmp: 0.085 },
  boss: { kind: 'boss', bodyR: 0.14, neckR: 0.045, neckLen: 0.62, score: 500, react: 1.1, swayAmp: 0.15, hp: 3 },
}

function at(kind, x, z, extra = {}) {
  return { ...PRIZE[kind], x, z, ...extra }
}

function depthScore(z) {
  if (z >= 3.56) return 1200
  if (z >= 3.4) return 1000
  if (z >= 2.85) return 800
  if (z >= 2.15) return 500
  return 250
}

function withDepthScore(list) {
  return list.map((p) => (p.kind === 'boss' ? p : { ...p, score: depthScore(p.z) }))
}

function standardLayout() {
  return withDepthScore([
    at('gosling', -0.66, 1.78),
    at('gosling', 0.66, 1.78),
    at('gosling', -0.22, 1.84),
    at('gosling', 0.22, 1.84),
    at('goose', -0.7, 2.44),
    at('goose', 0.7, 2.44),
    at('goose', -0.25, 2.5),
    at('goose', 0.25, 2.5),
    at('gander', -0.5, 3.08),
    at('gander', 0.5, 3.08),
    at('gander', 0, 3.14),
    at('gander', -0.62, 3.52),
    at('gander', 0.62, 3.52),
    at('gander', 0, 3.58),
  ])
}

function walkish(list, ampX = 0.11, ampZ = 0.05, speed = 0.62) {
  return list.map((p, i) => ({
    ...p,
    walk: true,
    walkAmpX: ampX,
    walkAmpZ: ampZ,
    walkSpeed: speed + (i % 3) * 0.08,
  }))
}

export const LEVELS = [
  {
    id: 1,
    key: 'stall',
    name: '夜市地摊',
    rings: 10,
    target: 1000,
    pitch: 38,
    wind: 0,
    duckCd: 2.0,
    walk: false,
    rain: false,
    matFric: 0.55,
    matRest: 0.12,
    prizes: standardLayout(),
  },
  {
    id: 2,
    key: 'wind',
    name: '庙会风口',
    rings: 10,
    target: 1100,
    pitch: 38,
    wind: 1.8,
    duckCd: 1.9,
    walk: false,
    rain: false,
    matFric: 0.55,
    matRest: 0.12,
    prizes: standardLayout(),
  },
  {
    id: 3,
    key: 'stroll',
    name: '遛弯鹅场',
    rings: 10,
    target: 1100,
    pitch: 38,
    wind: 0.6,
    duckCd: 1.8,
    walk: true,
    rain: false,
    matFric: 0.55,
    matRest: 0.12,
    prizes: walkish(standardLayout(), 0.12, 0.05, 0.7),
  },
  {
    id: 4,
    key: 'rain',
    name: '雨夜湿滑',
    rings: 10,
    target: 1200,
    pitch: 38,
    wind: 0.9,
    duckCd: 1.7,
    walk: false,
    rain: true,
    matFric: 0.25,
    matRest: 0.16,
    prizes: standardLayout(),
  },
  {
    id: 5,
    key: 'stampede',
    name: '鹅群暴走',
    rings: 12,
    target: 1300,
    pitch: 38,
    wind: 0,
    duckCd: 1.6,
    walk: true,
    rain: false,
    swayMul: 1.7,
    reactMul: 1.35,
    matFric: 0.5,
    matRest: 0.14,
    prizes: walkish(withDepthScore([
      at('gosling', -0.72, 1.72),
      at('gosling', -0.28, 1.76),
      at('gosling', 0.28, 1.76),
      at('gosling', 0.72, 1.72),
      at('goose', -0.55, 2.28),
      at('goose', 0.55, 2.28),
      at('goose', -0.18, 2.42),
      at('goose', 0.18, 2.42),
      at('gander', -0.4, 3.02),
      at('gander', 0.4, 3.02),
      at('gander', -0.55, 3.52),
      at('gander', 0.55, 3.52),
      at('gander', 0, 3.58),
    ]), 0.14, 0.06, 0.85),
  },
  {
    id: 6,
    key: 'boss',
    name: '觉醒的鹅王',
    rings: 15,
    target: 1500,
    pitch: 46,
    wind: 1.0,
    duckCd: 1.6,
    walk: true,
    rain: false,
    boss: true,
    matFric: 0.55,
    matRest: 0.12,
    prizes: [
      at('boss', 0, 2.5, { walk: true, walkAmpX: 0.3, walkAmpZ: 0.12, walkSpeed: 0.9, hp: 3 }),
      ...withDepthScore([
        at('gosling', -0.78, 1.8),
        at('gosling', 0.78, 1.8),
      ]),
    ],
  },
]

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0]
}
