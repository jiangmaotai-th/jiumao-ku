#!/usr/bin/env node
/**
 * Visitor + app analytics for maotaiworks.com
 *
 * Public:
 *   GET/POST /api/visit              → site-wide unique visitors { total, today }
 *   POST     /api/event              → { app, type: view|download|use, label? }
 *
 * Admin (cookie session):
 *   POST /api/admin/login            → { password }
 *   POST /api/admin/logout
 *   GET  /api/admin/stats            → dashboard payload
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT || 3190)
const DATA_FILE =
  process.env.VISITOR_DATA || path.join('/var/lib/maotaiworks', 'visitors.json')
const ANALYTICS_FILE =
  process.env.ANALYTICS_DATA || path.join('/var/lib/maotaiworks', 'analytics.json')
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const COOKIE_VID = 'mw_vid'
const COOKIE_ADMIN = 'mw_admin'
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ORIGIN = process.env.CORS_ORIGIN || 'https://maotaiworks.com'

const APP_META = {
  home: '首页',
  'store-price': 'AI 订阅低价区查询器',
  'xiaowu-image': '小午图片格式全能转换',
  ebook: '魔书',
  moyee: '魔叶 Converte',
  mowin: '魔窗',
  moyi: '魔译',
  'switch-price': 'Switch 低价查询器',
}

const sessions = new Map() // token -> expiresAt
const loginFails = new Map() // ip -> { count, until }

function shanghaiDateKey(d = new Date()) {
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS)
  return shifted.toISOString().slice(0, 10)
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
}

function atomicWrite(file, obj) {
  ensureDir(file)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, file)
}

function defaultSite() {
  return {
    total: 0,
    today: 0,
    todayKey: shanghaiDateKey(),
    updatedAt: new Date().toISOString(),
  }
}

function emptyMetric() {
  return { total: 0, today: 0 }
}

function emptyApp() {
  return {
    view: { ...emptyMetric(), uvTotal: 0, uvToday: 0 },
    download: emptyMetric(),
    use: emptyMetric(),
  }
}

function defaultAnalytics() {
  return {
    todayKey: shanghaiDateKey(),
    apps: {},
    /** per-app: vids that viewed today (reset daily) */
    uvToday: {},
    /** per-app: vids that ever viewed (lifetime UV) — capped growth via Set size ok for indie scale */
    uvAll: {},
    updatedAt: new Date().toISOString(),
  }
}

function loadJson(file, fallback) {
  try {
    return { ...fallback(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }
  } catch {
    return fallback()
  }
}

function loadSite() {
  const raw = loadJson(DATA_FILE, defaultSite)
  return {
    total: Number(raw.total) || 0,
    today: Number(raw.today) || 0,
    todayKey: typeof raw.todayKey === 'string' ? raw.todayKey : shanghaiDateKey(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}

function loadAnalytics() {
  const raw = loadJson(ANALYTICS_FILE, defaultAnalytics)
  return {
    todayKey: typeof raw.todayKey === 'string' ? raw.todayKey : shanghaiDateKey(),
    apps: raw.apps && typeof raw.apps === 'object' ? raw.apps : {},
    uvToday: raw.uvToday && typeof raw.uvToday === 'object' ? raw.uvToday : {},
    uvAll: raw.uvAll && typeof raw.uvAll === 'object' ? raw.uvAll : {},
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}

function rollSite(site) {
  const key = shanghaiDateKey()
  if (site.todayKey !== key) {
    site.today = 0
    site.todayKey = key
  }
  return site
}

function rollAnalytics(a) {
  const key = shanghaiDateKey()
  if (a.todayKey !== key) {
    a.todayKey = key
    a.uvToday = {}
    for (const app of Object.keys(a.apps)) {
      const m = a.apps[app]
      if (m.view) {
        m.view.today = 0
        m.view.uvToday = 0
      }
      if (m.download) m.download.today = 0
      if (m.use) m.use.today = 0
    }
  }
  return a
}

function ensureApp(a, appId) {
  if (!a.apps[appId]) a.apps[appId] = emptyApp()
  const m = a.apps[appId]
  if (!m.view) m.view = { ...emptyMetric(), uvTotal: 0, uvToday: 0 }
  if (!m.download) m.download = emptyMetric()
  if (!m.use) m.use = emptyMetric()
  if (m.view.uvTotal == null) m.view.uvTotal = 0
  if (m.view.uvToday == null) m.view.uvToday = 0
  return m
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  }
}

function sendJson(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...corsHeaders(),
    ...extraHeaders,
  })
  res.end(data)
}

function readBody(req, limit = 64_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('body_too_large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

function validAppId(id) {
  return typeof id === 'string' && /^[a-z0-9-]{1,48}$/.test(id)
}

function getOrCreateVid(req, setCookieHeaders) {
  const cookies = parseCookies(req.headers.cookie)
  if (cookies[COOKIE_VID] && /^[a-f0-9]{32}$/.test(cookies[COOKIE_VID])) {
    return cookies[COOKIE_VID]
  }
  const id = crypto.randomBytes(16).toString('hex')
  setCookieHeaders.push(
    `${COOKIE_VID}=${id}; Path=/; Max-Age=63072000; SameSite=Lax; Secure; HttpOnly`,
  )
  return id
}

function isAdmin(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_ADMIN]
  if (!token) return false
  const exp = sessions.get(token)
  if (!exp || exp < Date.now()) {
    sessions.delete(token)
    return false
  }
  return true
}

function pruneSessions() {
  const now = Date.now()
  for (const [t, exp] of sessions) {
    if (exp < now) sessions.delete(t)
  }
}

let site = rollSite(loadSite())
let analytics = rollAnalytics(loadAnalytics())

function saveAll() {
  site.updatedAt = new Date().toISOString()
  analytics.updatedAt = site.updatedAt
  atomicWrite(DATA_FILE, site)
  atomicWrite(ANALYTICS_FILE, analytics)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const { pathname } = url

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  try {
    // —— site visit (legacy) ——
    if (pathname === '/api/visit') {
      site = rollSite(site)
      if (req.method === 'GET') {
        sendJson(res, 200, { total: site.total, today: site.today })
        return
      }
      if (req.method === 'POST') {
        const cookies = parseCookies(req.headers.cookie)
        const headers = {}
        if (!cookies[COOKIE_VID]) {
          const id = crypto.randomBytes(16).toString('hex')
          site.total += 1
          site.today += 1
          saveAll()
          headers['Set-Cookie'] =
            `${COOKIE_VID}=${id}; Path=/; Max-Age=63072000; SameSite=Lax; Secure; HttpOnly`
        }
        sendJson(res, 200, { total: site.total, today: site.today }, headers)
        return
      }
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }

    // —— events ——
    if (pathname === '/api/event') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method_not_allowed' })
        return
      }
      const body = await readBody(req)
      const app = body.app
      const type = body.type
      if (!validAppId(app) || !['view', 'download', 'use'].includes(type)) {
        sendJson(res, 400, { error: 'bad_request' })
        return
      }

      analytics = rollAnalytics(analytics)
      const metric = ensureApp(analytics, app)
      const setCookies = []
      const vid = getOrCreateVid(req, setCookies)

      if (type === 'view') {
        metric.view.total += 1
        metric.view.today += 1
        if (!analytics.uvAll[app]) analytics.uvAll[app] = {}
        if (!analytics.uvToday[app]) analytics.uvToday[app] = {}
        if (!analytics.uvAll[app][vid]) {
          analytics.uvAll[app][vid] = true
          metric.view.uvTotal += 1
        }
        if (!analytics.uvToday[app][vid]) {
          analytics.uvToday[app][vid] = true
          metric.view.uvToday += 1
        }
      } else if (type === 'download') {
        metric.download.total += 1
        metric.download.today += 1
      } else if (type === 'use') {
        metric.use.total += 1
        metric.use.today += 1
      }

      saveAll()
      const headers = {}
      if (setCookies.length) headers['Set-Cookie'] = setCookies
      sendJson(res, 200, { ok: true }, headers)
      return
    }

    // —— admin ——
    if (pathname === '/api/admin/login') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method_not_allowed' })
        return
      }
      if (!ADMIN_PASSWORD) {
        sendJson(res, 503, { error: 'admin_not_configured' })
        return
      }
      const ip = clientIp(req)
      const fail = loginFails.get(ip)
      if (fail?.until && fail.until > Date.now()) {
        sendJson(res, 429, { error: 'too_many_attempts' })
        return
      }
      const body = await readBody(req)
      const password = typeof body.password === 'string' ? body.password : ''
      const a = Buffer.from(password)
      const b = Buffer.from(ADMIN_PASSWORD)
      const ok =
        a.length === b.length && crypto.timingSafeEqual(a, b)
      if (!ok) {
        const count = (fail?.count || 0) + 1
        loginFails.set(ip, {
          count,
          until: count >= 8 ? Date.now() + 15 * 60 * 1000 : 0,
        })
        sendJson(res, 401, { error: 'invalid_password' })
        return
      }
      loginFails.delete(ip)
      pruneSessions()
      const token = crypto.randomBytes(24).toString('hex')
      sessions.set(token, Date.now() + SESSION_TTL_MS)
      sendJson(res, 200, { ok: true }, {
        'Set-Cookie': `${COOKIE_ADMIN}=${token}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax; Secure; HttpOnly`,
      })
      return
    }

    if (pathname === '/api/admin/logout') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method_not_allowed' })
        return
      }
      const token = parseCookies(req.headers.cookie)[COOKIE_ADMIN]
      if (token) sessions.delete(token)
      sendJson(res, 200, { ok: true }, {
        'Set-Cookie': `${COOKIE_ADMIN}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`,
      })
      return
    }

    if (pathname === '/api/admin/stats') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method_not_allowed' })
        return
      }
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: 'unauthorized' })
        return
      }
      site = rollSite(site)
      analytics = rollAnalytics(analytics)

      const known = new Set([...Object.keys(APP_META), ...Object.keys(analytics.apps)])
      const apps = [...known]
        .sort((a, b) => a.localeCompare(b))
        .map((id) => {
          const m = ensureApp(analytics, id)
          return {
            id,
            name: APP_META[id] || id,
            viewPvTotal: m.view.total,
            viewPvToday: m.view.today,
            viewUvTotal: m.view.uvTotal,
            viewUvToday: m.view.uvToday,
            downloadTotal: m.download.total,
            downloadToday: m.download.today,
            useTotal: m.use.total,
            useToday: m.use.today,
          }
        })

      sendJson(res, 200, {
        site: { total: site.total, today: site.today },
        todayKey: analytics.todayKey,
        updatedAt: analytics.updatedAt,
        apps,
      })
      return
    }

    sendJson(res, 404, { error: 'not_found' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error'
    if (msg === 'invalid_json' || msg === 'body_too_large') {
      sendJson(res, 400, { error: msg })
      return
    }
    console.error(err)
    sendJson(res, 500, { error: 'server_error' })
  }
})

ensureDir(DATA_FILE)
ensureDir(ANALYTICS_FILE)
if (!fs.existsSync(DATA_FILE)) atomicWrite(DATA_FILE, site)
if (!fs.existsSync(ANALYTICS_FILE)) atomicWrite(ANALYTICS_FILE, analytics)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`analytics listening on 127.0.0.1:${PORT}`)
  if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD not set — admin login disabled')
})
