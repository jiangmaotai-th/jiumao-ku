import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR =
  process.env.STORE_DATA_DIR || path.join('/var/lib/maotaiworks', 'store')

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(path.join(DATA_DIR, 'prices'), { recursive: true })
  fs.mkdirSync(path.join(DATA_DIR, 'prices', 'products'), { recursive: true })
  fs.mkdirSync(path.join(DATA_DIR, 'history'), { recursive: true })
}

function atomicWrite(file, obj) {
  ensureDir()
  fs.mkdirSync(path.dirname(file), { recursive: true })
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

export function appsPath() {
  return path.join(DATA_DIR, 'apps.json')
}

export function fxPath() {
  return path.join(DATA_DIR, 'fx.json')
}

export function pricesPath(trackId) {
  return path.join(DATA_DIR, 'prices', `${trackId}.json`)
}

export function productChannelPath(productId, channel) {
  return path.join(DATA_DIR, 'prices', 'products', String(productId), `${channel}.json`)
}

export function metaPath() {
  return path.join(DATA_DIR, 'meta.json')
}

export function loadApps() {
  return readJson(appsPath(), { updatedAt: null, items: [] })
}

export function saveApps(doc) {
  atomicWrite(appsPath(), doc)
}

export function loadFx() {
  return readJson(fxPath(), { updatedAt: null, base: 'CNY', rates: { CNY: 1 } })
}

export function saveFx(doc) {
  atomicWrite(fxPath(), doc)
}

export function loadPrices(trackId) {
  return readJson(pricesPath(trackId), {
    trackId: Number(trackId),
    updatedAt: null,
    plans: [],
    byPlan: {},
  })
}

export function savePrices(trackId, doc) {
  atomicWrite(pricesPath(trackId), doc)
}

export function loadChannelPrices(productId, channel) {
  return readJson(productChannelPath(productId, channel), {
    productId: String(productId),
    channel: String(channel),
    updatedAt: null,
    plans: [],
    byPlan: {},
  })
}

export function saveChannelPrices(productId, channel, doc) {
  atomicWrite(productChannelPath(productId, channel), doc)
}

export function loadMeta() {
  return readJson(metaPath(), {
    lastRefreshAt: null,
    contentUpdatedAt: null,
    refreshing: null,
  })
}

export function saveMeta(doc) {
  atomicWrite(metaPath(), doc)
}

/**
 * Bump the public “更新时间” stamp shown on the homepage / store title.
 * Call this whenever AI subscription prices or related content are deployed or refreshed.
 */
export function touchContentUpdatedAt(reason = 'update') {
  const meta = loadMeta()
  const now = new Date().toISOString()
  const next = {
    ...meta,
    contentUpdatedAt: now,
    contentUpdatedReason: String(reason || 'update'),
  }
  saveMeta(next)
  return now
}

export function contentUpdatedAt() {
  const meta = loadMeta()
  return meta.contentUpdatedAt || meta.lastRefreshAt || null
}

export function upsertApp(app) {
  const doc = loadApps()
  const idx = doc.items.findIndex((a) => a.trackId === app.trackId)
  if (idx >= 0) doc.items[idx] = { ...doc.items[idx], ...app }
  else doc.items.push(app)
  doc.updatedAt = new Date().toISOString()
  saveApps(doc)
  return app
}

export function getApp(trackId) {
  const id = Number(trackId)
  return loadApps().items.find((a) => a.trackId === id) || null
}

export { DATA_DIR, ensureDir }
