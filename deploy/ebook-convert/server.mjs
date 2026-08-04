#!/usr/bin/env node
/**
 * Calibre-backed ebook convert API for AZW3/MOBI (+ OCR for scanned PDFs).
 * Old Word .doc goes through LibreOffice first (Calibre has no DOC input plugin).
 * POST /api/ebook-convert  multipart: file + from + to
 * Temp files are always deleted after the request.
 */
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT || 3191)
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 40 * 1024 * 1024)
const CONVERT_BIN = process.env.EBOOK_CONVERT || 'ebook-convert'
const LIBREOFFICE_BIN = process.env.LIBREOFFICE || 'libreoffice'
const OCRMYPDF_BIN = process.env.OCRMYPDF || 'ocrmypdf'
const PDFTOTEXT_BIN = process.env.PDFTOTEXT || 'pdftotext'
const PDFINFO_BIN = process.env.PDFINFO || 'pdfinfo'
const OCR_LANG = process.env.OCR_LANG || 'chi_sim+eng'
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES || 80)
const OCR_MIN_CHARS_PER_PAGE = Number(process.env.OCR_MIN_CHARS_PER_PAGE || 40)
const CONVERT_TIMEOUT_MS = Number(process.env.CONVERT_TIMEOUT_MS || 180000)
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 420000)
const ALLOWED = new Set(['epub', 'pdf', 'txt', 'doc', 'docx', 'mobi', 'azw3', 'html', 'htm'])
const REFLOWABLE = new Set(['epub', 'mobi', 'azw3', 'txt'])

const DRM_MESSAGE =
  '该文件受 DRM（数字版权保护）加密，魔书不提供也不协助移除 DRM。请改用无加密 / DRM-free 版本后再转换。'

function readU16BE(buf, offset) {
  return buf.readUInt16BE(offset)
}

function readU32BE(buf, offset) {
  return buf.readUInt32BE(offset)
}

function detectDrmBuffer(from, data) {
  if (from === 'epub' || from === 'azw3') {
    const latin = data.toString('latin1')
    if (/META-INF\/encryption\.xml/i.test(latin) || /META-INF\/rights\.xml/i.test(latin)) {
      return 'encryption.xml'
    }
    if (/xmlns:adept|urn:adept|adept:resource/i.test(latin)) return 'Adobe ADEPT'
  }
  if (from === 'mobi' || from === 'azw3') {
    if (data.length >= 86) {
      try {
        const first = readU32BE(data, 78)
        if (first + 14 <= data.length) {
          const enc = readU16BE(data, first + 12)
          if (enc !== 0) return 'MOBI encryption'
        }
      } catch {
        /* ignore */
      }
    }
    const head = data.subarray(0, Math.min(data.length, 65536)).toString('latin1')
    if (/DRM_KEY|DRMION|KindleEbookEncryption|PDOC_ENCRYPT/i.test(head)) {
      return 'Kindle DRM'
    }
  }
  if (from === 'pdf') {
    const head = data.subarray(0, Math.min(data.length, 1024 * 64)).toString('latin1')
    if (
      /\/Encrypt\b/.test(head) &&
      (/\/Filter\s*\/Standard/i.test(head) || /\/CFM\s*\/AES/i.test(head))
    ) {
      return 'PDF Encrypt'
    }
  }
  return null
}

function mapConvertError(message) {
  if (/DRM|encrypted|encryption|password|adept/i.test(message)) {
    return DRM_MESSAGE
  }
  return message
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

function parseMultipart(buf, boundary) {
  const sep = Buffer.from(`--${boundary}`)
  const parts = []
  let start = buf.indexOf(sep) + sep.length
  while (start < buf.length) {
    if (buf[start] === 45 && buf[start + 1] === 45) break
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2
    const headerEnd = buf.indexOf('\r\n\r\n', start)
    if (headerEnd < 0) break
    const headers = buf.slice(start, headerEnd).toString('utf8')
    const next = buf.indexOf(sep, headerEnd + 4)
    const end = next < 0 ? buf.length : next - 2
    const content = buf.slice(headerEnd + 4, end)
    const nameMatch = /name="([^"]+)"/.exec(headers)
    const fileMatch = /filename="([^"]+)"/.exec(headers)
    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: fileMatch?.[1] || null,
        data: content,
      })
    }
    start = next < 0 ? buf.length : next + sep.length
  }
  return parts
}

function runCmd(bin, args, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${label}超时（请减少页数或稍后重试）`))
    }, timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error((stderr || stdout).trim() || `${label}失败 code=${code}`))
    })
  })
}

async function pdfPageCount(pdfPath) {
  try {
    const { stdout } = await runCmd(PDFINFO_BIN, [pdfPath], 15000, 'pdfinfo')
    const m = /Pages:\s+(\d+)/i.exec(stdout)
    return m ? Number(m[1]) : 0
  } catch {
    return 0
  }
}

async function pdfExtractedChars(pdfPath) {
  try {
    const { stdout } = await runCmd(
      PDFTOTEXT_BIN,
      ['-q', '-enc', 'UTF-8', pdfPath, '-'],
      60000,
      'pdftotext',
    )
    return stdout.replace(/\s+/g, '').length
  } catch {
    return 0
  }
}

async function pdfNeedsOcr(pdfPath) {
  const pages = Math.max(1, await pdfPageCount(pdfPath))
  const chars = await pdfExtractedChars(pdfPath)
  return chars / pages < OCR_MIN_CHARS_PER_PAGE
}

async function runOcr(inputPath, outputPath) {
  const args = [
    '--language',
    OCR_LANG,
    '--skip-text',
    '--rotate-pages',
    '--deskew',
    '--optimize',
    '0',
    '--jobs',
    '1',
    '--output-type',
    'pdf',
  ]
  if (OCR_MAX_PAGES > 0) {
    args.push('--pages', `1-${OCR_MAX_PAGES}`)
  }
  args.push(inputPath, outputPath)
  await runCmd(OCRMYPDF_BIN, args, OCR_TIMEOUT_MS, 'OCR')
}

function buildConvertArgs(from, to, inputPath, outputPath) {
  const args = [inputPath, outputPath, '--pretty-print']
  if (to === 'mobi') {
    args.push('--mobi-file-type=both')
  }
  if (to === 'pdf') {
    args.push('--pdf-page-numbers')
  }
  if (to === 'epub' || to === 'azw3' || to === 'mobi') {
    args.push('--embed-all-fonts')
  }
  if (from === 'pdf' && (to === 'mobi' || to === 'azw3' || to === 'epub')) {
    args.push('--base-font-size=12')
  }
  return args
}

function runConvert(from, to, inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = buildConvertArgs(from, to, inputPath, outputPath)
    const child = spawn(CONVERT_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('转换超时（请换较小文件或稍后重试）'))
    }, CONVERT_TIMEOUT_MS)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && fs.existsSync(outputPath)) resolve()
      else reject(new Error(stderr.trim() || `ebook-convert 失败 code=${code}`))
    })
  })
}

/** Old Word .doc → LibreOffice, then Calibre when needed for MOBI/AZW3. */
async function convertDocWithLibreOffice(inputPath, dir, to, outputPath) {
  const loInput = path.join(dir, 'lo-in.doc')
  fs.copyFileSync(inputPath, loInput)

  const direct = to === 'pdf' || to === 'txt' || to === 'epub' || to === 'html' || to === 'htm'
  const loTo = to === 'txt' ? 'txt:Text' : to === 'htm' ? 'html' : direct ? to : 'docx'
  const midExt = to === 'txt' ? 'txt' : to === 'htm' ? 'html' : direct ? to : 'docx'

  await runCmd(
    LIBREOFFICE_BIN,
    ['--headless', '--norestore', '--convert-to', loTo, '--outdir', dir, loInput],
    OCR_TIMEOUT_MS,
    'LibreOffice',
  )

  const produced = path.join(dir, `lo-in.${midExt}`)
  if (!fs.existsSync(produced)) {
    throw new Error('旧版 DOC 转换失败（LibreOffice 未生成输出）')
  }

  if (direct) {
    fs.copyFileSync(produced, outputPath)
    return
  }

  await runConvert('docx', to, produced, outputPath)
}

function cleanup(...files) {
  for (const f of files) {
    try {
      if (f && fs.existsSync(f)) fs.unlinkSync(f)
    } catch {
      /* ignore */
    }
  }
}

async function ocrAvailable() {
  try {
    await runCmd(OCRMYPDF_BIN, ['--version'], 10000, 'ocrmypdf')
    return true
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname !== '/api/ebook-convert') {
    sendJson(res, 404, { error: 'not_found' })
    return
  }

  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    const ocr = await ocrAvailable()
    sendJson(res, 200, { ok: true, engine: 'calibre', ocr, doc: true })
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' })
    return
  }

  const ctype = req.headers['content-type'] || ''
  const m = /boundary=(.+)$/i.exec(ctype)
  if (!m) {
    sendJson(res, 400, { error: 'expected_multipart' })
    return
  }
  const boundary = m[1].trim().replace(/^"|"$/g, '')

  const chunks = []
  let size = 0
  try {
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BYTES + 1024 * 1024) {
        sendJson(res, 413, { error: 'file_too_large', maxBytes: MAX_BYTES })
        return
      }
      chunks.push(chunk)
    }
  } catch {
    sendJson(res, 400, { error: 'read_failed' })
    return
  }

  const buf = Buffer.concat(chunks)
  const parts = parseMultipart(buf, boundary)
  const filePart = parts.find((p) => p.name === 'file' && p.filename)
  const from = (parts.find((p) => p.name === 'from')?.data.toString('utf8') || '').toLowerCase()
  const to = (parts.find((p) => p.name === 'to')?.data.toString('utf8') || '').toLowerCase()

  if (!filePart || !ALLOWED.has(from) || !ALLOWED.has(to)) {
    sendJson(res, 400, { error: 'invalid_params', from, to })
    return
  }
  if (filePart.data.length > MAX_BYTES) {
    sendJson(res, 413, { error: 'file_too_large', maxBytes: MAX_BYTES })
    return
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-ebook-'))
  const inExt = from === 'htm' ? 'html' : from
  const outExt = to === 'htm' ? 'html' : to
  const inputPath = path.join(dir, `in.${inExt}`)
  const outputPath = path.join(dir, `out.${outExt}`)
  const ocrPath = path.join(dir, 'ocr.pdf')
  const safeName = (filePart.filename || `book.${inExt}`).replace(/[^\w.\u4e00-\u9fff-]+/g, '_')
  const downloadName = safeName.replace(/\.[^.]+$/, '') + `.${outExt}`

  let ocrApplied = false
  try {
    fs.writeFileSync(inputPath, filePart.data)

    const drmHit = detectDrmBuffer(from, filePart.data)
    if (drmHit) {
      sendJson(res, 403, { error: 'drm_protected', message: DRM_MESSAGE, detail: drmHit })
      return
    }

    if (from === 'doc') {
      await convertDocWithLibreOffice(inputPath, dir, outExt, outputPath)
    } else {
      let convertInput = inputPath
      if (from === 'pdf' && REFLOWABLE.has(to)) {
        const needs = await pdfNeedsOcr(inputPath)
        if (needs) {
          const pages = await pdfPageCount(inputPath)
          if (pages > OCR_MAX_PAGES) {
            sendJson(res, 413, {
              error: 'ocr_too_many_pages',
              message: `扫描版 PDF 超过 ${OCR_MAX_PAGES} 页，请先拆分后再转（OCR 较耗资源）`,
              maxPages: OCR_MAX_PAGES,
            })
            return
          }
          await runOcr(inputPath, ocrPath)
          convertInput = ocrPath
          ocrApplied = true
        }
      }
      await runConvert(from, to, convertInput, outputPath)
    }

    const out = fs.readFileSync(outputPath)
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': out.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'X-Output-Name': encodeURIComponent(downloadName),
      'X-Ocr-Applied': ocrApplied ? '1' : '0',
      'Cache-Control': 'no-store',
    })
    res.end(out)
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const message = mapConvertError(raw)
    const drm = message === DRM_MESSAGE
    sendJson(res, drm ? 403 : 500, {
      error: drm ? 'drm_protected' : 'convert_failed',
      message,
    })
  } finally {
    cleanup(inputPath, outputPath, ocrPath)
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ebook-convert listening on 127.0.0.1:${PORT}`)
})
