const KEY = 'quanyun_board_v1'

function readLocal() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeLocal(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))) } catch { /* */ }
}

export async function fetchBoard() {
  try {
    const res = await fetch('/api/goose/board')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.list)) return data.list
    }
  } catch { /* offline */ }
  return readLocal()
}

export async function submitBoard(entry) {
  const row = {
    name: String(entry.name || '夜市游客').slice(0, 12),
    geese: Math.max(0, Math.floor(Number(entry.geese) || 0)),
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    diff: entry.diff || 'normal',
    at: Date.now(),
  }
  const local = readLocal()
  local.push(row)
  local.sort((a, b) => b.geese - a.geese || b.score - a.score)
  writeLocal(local)
  try {
    await fetch('/api/goose/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
  } catch { /* keep local */ }
  return fetchBoard()
}
