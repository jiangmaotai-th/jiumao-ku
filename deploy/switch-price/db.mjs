import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR =
  process.env.SWITCH_DATA_DIR || path.join('/var/lib/maotaiworks', 'switch')

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(path.join(DATA_DIR, 'prices'), { recursive: true })
}

function atomicWrite(file, obj) {
  ensureDir()
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, file)
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function gamesPath() {
  return path.join(DATA_DIR, 'games.json')
}

export function fxPath() {
  return path.join(DATA_DIR, 'fx.json')
}

export function pricesPath(gameId) {
  return path.join(DATA_DIR, 'prices', `${gameId}.json`)
}

export function metaPath() {
  return path.join(DATA_DIR, 'meta.json')
}

export function loadGames() {
  return readJson(gamesPath(), { updatedAt: null, items: [] })
}

export function saveGames(doc) {
  atomicWrite(gamesPath(), doc)
}

export function loadFx() {
  return readJson(fxPath(), { updatedAt: null, base: 'CNY', rates: { CNY: 1 } })
}

export function saveFx(doc) {
  atomicWrite(fxPath(), doc)
}

export function loadPrices(gameId) {
  return readJson(pricesPath(gameId), {
    gameId: String(gameId),
    updatedAt: null,
    nsuids: {},
    rows: [],
  })
}

export function savePrices(gameId, doc) {
  atomicWrite(pricesPath(gameId), doc)
}

export function loadMeta() {
  return readJson(metaPath(), { lastRefreshAt: null, refreshing: null })
}

export function saveMeta(doc) {
  atomicWrite(metaPath(), doc)
}

export function upsertGame(game) {
  const doc = loadGames()
  const id = String(game.gameId)
  const idx = doc.items.findIndex((a) => String(a.gameId) === id)
  if (idx >= 0) {
    const prev = doc.items[idx]
    const next = { ...prev, ...game, gameId: id }
    // Never blank out a known cover with an empty string from a partial update.
    if (!next.icon && prev.icon) next.icon = prev.icon
    doc.items[idx] = next
  } else {
    doc.items.push({ ...game, gameId: id })
  }
  doc.updatedAt = new Date().toISOString()
  saveGames(doc)
  return doc.items.find((a) => String(a.gameId) === id)
}

export function getGame(gameId) {
  const id = String(gameId)
  return loadGames().items.find((a) => String(a.gameId) === id) || null
}

export { DATA_DIR, ensureDir }
