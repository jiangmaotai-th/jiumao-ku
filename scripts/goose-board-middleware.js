import fs from 'node:fs'
import path from 'node:path'

export function createGooseBoardMiddleware(root) {
  const file = path.join(root, 'data', 'goose-board.json')

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
    fs.writeFileSync(file, JSON.stringify(list.slice(0, 50), null, 2))
  }

  return async function gooseBoard(req, res, next) {
    const url = req.url?.split('?')[0] || ''
    if (url !== '/api/goose/board') return next()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method === 'GET') {
      res.end(JSON.stringify({ list: readList() }))
      return
    }
    if (req.method === 'POST') {
      const chunks = []
      for await (const c of req) chunks.push(c)
      let body = {}
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { body = {} }
      const row = {
        name: String(body.name || '夜市游客').slice(0, 12),
        geese: Math.max(0, Math.floor(Number(body.geese) || 0)),
        score: Math.max(0, Math.floor(Number(body.score) || 0)),
        diff: ['easy', 'normal', 'hard'].includes(body.diff) ? body.diff : 'normal',
        at: Date.now(),
      }
      const list = readList()
      list.push(row)
      list.sort((a, b) => b.geese - a.geese || b.score - a.score)
      writeList(list)
      res.end(JSON.stringify({ ok: true, list: list.slice(0, 50) }))
      return
    }
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'method_not_allowed' }))
  }
}
