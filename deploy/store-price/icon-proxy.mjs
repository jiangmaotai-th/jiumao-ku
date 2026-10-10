/**
 * Same-origin product icons.
 * Google favicon URLs often fail on iPad/Safari in CN; we fetch server-side and cache.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ensureDir } from './db.mjs'

const ICON_DIR = path.join(DATA_DIR, 'icons')
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function safeDomain(domain) {
  return String(domain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim()
    .toLowerCase()
}

function isSafeDomain(domain) {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain) && !domain.includes('..')
}

function letterPlaceholder(domain) {
  const letter = (domain?.[0] || '?').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#1a211c"/>
  <rect x="1" y="1" width="126" height="126" rx="23" fill="none" stroke="#c4a35a" stroke-opacity="0.35"/>
  <text x="64" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#d4b87a">${letter}</text>
</svg>`
  return { buf: Buffer.from(svg), contentType: 'image/svg+xml; charset=utf-8' }
}

function cachePath(domain) {
  return path.join(ICON_DIR, `${domain.replace(/[^a-z0-9.-]/gi, '_')}.bin`)
}

function metaPath(domain) {
  return path.join(ICON_DIR, `${domain.replace(/[^a-z0-9.-]/gi, '_')}.json`)
}

function readCache(domain) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath(domain), 'utf8'))
    if (!meta?.fetchedAt || Date.now() - new Date(meta.fetchedAt).getTime() > MAX_AGE_MS) {
      return null
    }
    const buf = fs.readFileSync(cachePath(domain))
    if (!buf?.length) return null
    return { buf, contentType: meta.contentType || 'image/png' }
  } catch {
    return null
  }
}

function writeCache(domain, buf, contentType) {
  ensureDir()
  fs.mkdirSync(ICON_DIR, { recursive: true })
  fs.writeFileSync(cachePath(domain), buf)
  fs.writeFileSync(
    metaPath(domain),
    JSON.stringify({ fetchedAt: new Date().toISOString(), contentType, bytes: buf.length }),
  )
}

async function fetchOne(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'maotaiworks-store-icon/1.0 (+https://maotaiworks.com)',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 40) return null
  const contentType = (res.headers.get('content-type') || 'image/png').split(';')[0]
  if (!contentType.startsWith('image/')) return null
  return { buf, contentType }
}

async function fetchRemote(domain) {
  const sources = [
    `https://icon.horse/icon/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
  ]
  for (const url of sources) {
    try {
      const hit = await fetchOne(url)
      if (hit) return hit
    } catch {
      /* try next */
    }
  }
  return null
}

/** Resolve icon bytes for a domain (cache → remote → letter SVG). */
export async function resolveDomainIcon(domainRaw) {
  const domain = safeDomain(domainRaw)
  if (!domain || !isSafeDomain(domain)) return letterPlaceholder(domain || '?')
  const cached = readCache(domain)
  if (cached) return cached
  const remote = await fetchRemote(domain)
  if (remote) {
    try {
      writeCache(domain, remote.buf, remote.contentType)
    } catch {
      /* ignore cache write errors */
    }
    return remote
  }
  return letterPlaceholder(domain)
}

export function sendIcon(res, { buf, contentType }) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=604800',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(buf)
}
