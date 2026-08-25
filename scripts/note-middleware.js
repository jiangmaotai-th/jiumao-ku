import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const MAX_LEN = 200
const MAX_NOTES = 2000
const noteHits = new Map()

function tooMany(ip) {
  const now = Date.now()
  const row = noteHits.get(ip) || { n: 0, t: now }
  if (now - row.t > 10 * 60 * 1000) {
    noteHits.set(ip, { n: 1, t: now })
    return false
  }
  row.n += 1
  noteHits.set(ip, row)
  return row.n > 8
}

export function createNoteMiddleware(root) {
  const file = path.join(root, 'data', 'notes.json')

  function readList() {
    try {
      const list = JSON.parse(fs.readFileSync(file, 'utf8'))
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }

  function writeList(list) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(list.slice(0, MAX_NOTES), null, 2))
  }

  return async function notes(req, res, next) {
    const url = req.url?.split('?')[0] || ''
    if (url !== '/api/note' && url !== '/api/admin/notes') return next()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    if (url === '/api/note') {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'method_not_allowed' }))
        return
      }
      const ip = req.socket?.remoteAddress || 'local'
      if (tooMany(ip)) {
        res.statusCode = 429
        res.end(JSON.stringify({ error: 'too_many' }))
        return
      }
      const chunks = []
      for await (const c of req) chunks.push(c)
      let body = {}
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { body = {} }
      const text = String(body.text || '').replace(/\r\n/g, '\n').trim().slice(0, MAX_LEN)
      if (text.length < 2) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'empty' }))
        return
      }
      const list = readList()
      list.unshift({
        id: crypto.randomBytes(8).toString('hex'),
        text,
        path: String(body.path || '').slice(0, 180),
        locale: String(body.locale || '').slice(0, 12),
        at: Date.now(),
      })
      writeList(list)
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (req.method !== 'GET') {
      res.statusCode = 405
      res.end(JSON.stringify({ error: 'method_not_allowed' }))
      return
    }
    res.end(JSON.stringify({ list: readList() }))
  }
}
