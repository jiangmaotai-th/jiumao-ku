#!/usr/bin/env node
/**
 * Tiny visitor counter for maotaiworks.com
 * GET/POST /api/visit  →  { total, today }
 * Unique visitors via long-lived cookie; today resets at UTC+8 midnight.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT || 3190)
const DATA_FILE =
  process.env.VISITOR_DATA ||
  path.join('/var/lib/maotaiworks', 'visitors.json')
const COOKIE_NAME = 'mw_vid'
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Shanghai

function shanghaiDateKey(d = new Date()) {
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS)
  return shifted.toISOString().slice(0, 10)
}

function defaultState() {
  return { total: 0, today: 0, todayKey: shanghaiDateKey(), updatedAt: new Date().toISOString() }
}

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
}

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      total: Number(parsed.total) || 0,
      today: Number(parsed.today) || 0,
      todayKey: typeof parsed.todayKey === 'string' ? parsed.todayKey : shanghaiDateKey(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return defaultState()
  }
}

function saveState(state) {
  ensureDataDir()
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}

function rollToday(state) {
  const key = shanghaiDateKey()
  if (state.todayKey !== key) {
    state.today = 0
    state.todayKey = key
  }
  return state
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    out[k] = decodeURIComponent(v)
  }
  return out
}

function sendJson(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': 'https://maotaiworks.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders,
  })
  res.end(data)
}

let state = rollToday(loadState())

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS' && url.pathname === '/api/visit') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'https://maotaiworks.com',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (url.pathname !== '/api/visit') {
    sendJson(res, 404, { error: 'not_found' })
    return
  }

  state = rollToday(state)

  if (req.method === 'GET') {
    sendJson(res, 200, { total: state.total, today: state.today })
    return
  }

  if (req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie)
    const existing = cookies[COOKIE_NAME]
    const headers = {}

    if (!existing) {
      const id = crypto.randomBytes(16).toString('hex')
      state.total += 1
      state.today += 1
      state.updatedAt = new Date().toISOString()
      saveState(state)
      headers['Set-Cookie'] =
        `${COOKIE_NAME}=${id}; Path=/; Max-Age=63072000; SameSite=Lax; Secure; HttpOnly`
    }

    sendJson(res, 200, { total: state.total, today: state.today }, headers)
    return
  }

  sendJson(res, 405, { error: 'method_not_allowed' })
})

ensureDataDir()
if (!fs.existsSync(DATA_FILE)) saveState(state)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`visitor-counter listening on 127.0.0.1:${PORT}`)
})
