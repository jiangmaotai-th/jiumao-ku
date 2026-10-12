/**
 * Single source for arena board metadata written onto every board object in
 * index.json and latest.json (and the dated copies of those files).
 *
 * Field names and placement match feat/arena-v2-data:
 * src/arena/data.ts reads `unit`, `higherIsBetter`, and `category` on each
 * index board (`k`/`span`/`n` object) and on each latest.json board.
 *
 * `unit` is the lowercase frontend enum `elo`. checkBoardMeta only allows
 * `elo` | `percent` | `index`, and tests/arena/boards.check.ts rejects `Elo`.
 * All current Arena.ai boards are Bradley-Terry scores, so the value is `elo`.
 *
 * Category values follow the owner's list. `creative` and `vision` are not in
 * the frontend BoardCategory yet (`arena` | `code` | `math` | `knowledge` |
 * `index` | `pelican`); they are still emitted as specified.
 *
 * A key missing from ARENA_BOARD_META_BY_KEY has no known mapping. Callers
 * must fail the release instead of guessing a category.
 */

export const ARENA_BOARD_CATEGORIES = Object.freeze([
  'arena',
  'code',
  'math',
  'knowledge',
  'index',
  'pelican',
  'creative',
  'vision',
])

const CATEGORY_SET = new Set(ARENA_BOARD_CATEGORIES)

/** Owner mapping: general text, coding, webdev, math, creative writing, vision. */
export const ARENA_BOARD_META_BY_KEY = Object.freeze({
  text: Object.freeze({ unit: 'elo', higherIsBetter: true, category: 'arena' }),
  coding: Object.freeze({ unit: 'elo', higherIsBetter: true, category: 'code' }),
  webdev: Object.freeze({ unit: 'elo', higherIsBetter: true, category: 'code' }),
  math: Object.freeze({ unit: 'elo', higherIsBetter: true, category: 'math' }),
  creative: Object.freeze({ unit: 'elo', higherIsBetter: true, category: 'creative' }),
  vision: Object.freeze({ unit: 'elo', higherIsBetter: true, category: 'vision' }),
})

for (const [key, meta] of Object.entries(ARENA_BOARD_META_BY_KEY)) {
  if (!CATEGORY_SET.has(meta.category) || typeof meta.unit !== 'string' || typeof meta.higherIsBetter !== 'boolean') {
    throw new Error(`arena board map is invalid for ${key}`)
  }
}

export function arenaBoardMeta(key) {
  if (typeof key !== 'string' || !Object.hasOwn(ARENA_BOARD_META_BY_KEY, key)) {
    throw new Error(`arena board ${JSON.stringify(key)} has no category mapping`)
  }
  const meta = ARENA_BOARD_META_BY_KEY[key]
  if (!CATEGORY_SET.has(meta.category)) {
    throw new Error(`arena board ${JSON.stringify(key)} category ${JSON.stringify(meta.category)} is not allowed`)
  }
  return { unit: meta.unit, higherIsBetter: meta.higherIsBetter, category: meta.category }
}

/** Every key that cannot be labeled. Order follows `keys`. */
export function unmappedArenaBoardKeys(keys) {
  const missing = []
  for (const key of keys) {
    try {
      arenaBoardMeta(key)
    } catch {
      missing.push(key)
    }
  }
  return missing
}

export function assertArenaBoardFields(board, key) {
  const meta = arenaBoardMeta(key)
  const label = `arena board ${JSON.stringify(key)}`
  if (!board || typeof board !== 'object') throw new Error(`${label} is missing`)
  if (board.unit !== meta.unit) throw new Error(`${label} unit must be ${JSON.stringify(meta.unit)}`)
  if (board.higherIsBetter !== meta.higherIsBetter) {
    throw new Error(`${label} higherIsBetter must be ${JSON.stringify(meta.higherIsBetter)}`)
  }
  if (board.category !== meta.category) throw new Error(`${label} category must be ${JSON.stringify(meta.category)}`)
  return meta
}
