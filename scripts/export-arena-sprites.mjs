import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const [,, out = '/tmp/roster.png', sheetsDir] = process.argv
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1400, height: 1000 })
p.on('pageerror', (e) => console.log('ERR', String(e)))
p.on('console', (m) => console.log('LOG', m.text()))
await p.goto('http://localhost:5173/robots.txt')
const res = await p.evaluate(async (wantSheets) => {
  const m = await import('/src/arena/fighters.ts')
  const i18n = await import('/src/i18n/arena-extra.ts')
  const ff = new FontFace('ArenaPixel', "url('/fonts/arena-pixel.woff2')"); document.fonts.add(await ff.load())
  const ex = i18n.arenaExtra('zh-CN')
  document.documentElement.innerHTML = '<body style="margin:0;background:#1a1230"></body>'
  const av = Object.keys(m.FIGHTERS)
  const COLS = 7
  const S = 3, CW = 68 * S + 90, CH = 68 * S + 120
  const c = document.createElement('canvas'); c.width = CW * COLS; c.height = CH * Math.ceil(av.length / COLS) + 70
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false
  // backdrop: checker floor like a select screen
  x.fillStyle = '#1a1230'; x.fillRect(0, 0, c.width, c.height)
  x.font = '24px ArenaPixel'; x.fillStyle = '#ffd23f'; x.textAlign = 'center'; x.textBaseline = 'top'
  x.fillText('SELECT YOUR FIGHTER · 选择你的斗士', c.width / 2, 20)
  const sheets = {}
  av.forEach((a, i) => {
    const cx = (i % COLS) * CW, cy = 70 + Math.floor(i / COLS) * CH
    x.fillStyle = i % 2 ? '#261a46' : '#2c1f52'; x.fillRect(cx + 8, cy, CW - 16, CH - 10)
    x.fillStyle = '#3d2c6e'; x.fillRect(cx + 8, cy + 68 * S - 20, CW - 16, 4)
    const f = m.renderFrame(a, 'idle0')
    x.drawImage(f, cx + 45, cy, 68 * S, 68 * S)
    // mini strip of all poses
    m.POSE_LIST.forEach((ps, j) => x.drawImage(m.renderFrame(a, ps), cx + 12 + j * 22, cy + 68 * S - 10, 22, 22))
    x.font = '12px ArenaPixel'; x.fillStyle = '#fff'; x.fillText(ex.chars[a], cx + CW / 2, cy + 68 * S + 18)
    x.font = '12px ArenaPixel'; x.fillStyle = '#ffd23f'; x.fillText('「' + ex.moves[a] + '」', cx + CW / 2, cy + 68 * S + 38)
    x.fillStyle = '#b8a8e8'; x.fillText(ex.intro[a].slice(0, 22), cx + CW / 2, cy + 68 * S + 58)
    if (wantSheets) {
      const sh = document.createElement('canvas'); sh.width = 68 * m.POSE_LIST.length; sh.height = 68
      const sx = sh.getContext('2d')
      m.POSE_LIST.forEach((ps, j) => sx.drawImage(m.renderFrame(a, ps), j * 68, 0))
      sheets[a] = sh.toDataURL('image/png')
    }
  })
  document.body.appendChild(c)
  return sheets
}, !!sheetsDir)
await (await p.$('canvas')).screenshot({ path: out })
if (sheetsDir) for (const [a, url] of Object.entries(res)) fs.writeFileSync(`${sheetsDir}/${a}.png`, Buffer.from(url.split(',')[1], 'base64'))
await b.close()
