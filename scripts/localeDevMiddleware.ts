/**
 * Vite middleware: locale path rewrite + bare-path redirects (mirrors production nginx).
 */
import type { Plugin } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LOCALE_SLUGS = new Set([
  'zh-cn',
  'zh-tw',
  'en',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'hi',
  'th',
  'ru',
  'pt',
])

const DEFAULT_SLUG = 'zh-cn'

const APP_PREFIXES = [
  '/moyee',
  '/ebook',
  '/image',
  '/store',
  '/switch',
  '/legal',
  '/markdown',
  '/platform-crop',
  '/video-mute',
  '/scratch',
  '/tank',
  '/goose',
  '/ai',
  '/arena',
]

const PASSTHROUGH = [
  '/src/',
  '/assets/',
  '/api/',
  '/downloads/',
  '/generated-assets/',
  '/audio/',
  '/covers/',
  '/tank/',
  '/goose/',
  '/ffmpeg/',
  '/admin/',
  '/@',
  '/node_modules/',
  '/favicon',
  '/pdf.worker',
  '/robots.txt',
  '/sitemap',
  '/ai-daily/',
  '/ai-skills/',
  '/arena-data/',
  '/arena-sprites/',
]

function isPassthrough(urlPath: string): boolean {
  return PASSTHROUGH.some((p) => urlPath === p.replace(/\/$/, '') || urlPath.startsWith(p))
}

function stripLocale(urlPath: string): { slug: string | null; rest: string } {
  const parts = urlPath.split('/').filter(Boolean)
  if (parts.length === 0) return { slug: null, rest: '/' }
  if (!LOCALE_SLUGS.has(parts[0].toLowerCase())) return { slug: null, rest: urlPath }
  const rest = parts.length === 1 ? '/' : `/${parts.slice(1).join('/')}`
  return { slug: parts[0].toLowerCase(), rest: rest.endsWith('/') || rest === '/' ? rest : `${rest}/` }
}

function resolveAppHtml(root: string, appPath: string): string | null {
  if (appPath === '/' || appPath === '') {
    const p = join(root, 'index.html')
    return existsSync(p) ? p : null
  }
  const cleaned = appPath.replace(/\/$/, '')
  const candidates = [
    join(root, cleaned.slice(1), 'index.html'),
    join(root, cleaned.slice(1) + '.html'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

export function localeDevMiddleware(): Plugin {
  const handler = (serverRoot: string, transform?: (url: string, html: string) => Promise<string>) => {
    return (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: (err?: unknown) => void) => {
      if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) return next()

      const raw = req.url.split('?')[0] || '/'
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''

      if (isPassthrough(raw)) return next()
      if (raw.includes('.') && !raw.endsWith('.html')) {
        if (!LOCALE_SLUGS.has(raw.split('/').filter(Boolean)[0]?.toLowerCase() || '')) {
          return next()
        }
      }

      const { slug, rest } = stripLocale(raw)

      if (!slug && (raw === '/' || raw === '')) {
        res.statusCode = 301
        res.setHeader('Location', `/${DEFAULT_SLUG}/${qs}`)
        res.end()
        return
      }

      if (!slug) {
        const hit = APP_PREFIXES.find((p) => raw === p || raw === `${p}/` || raw.startsWith(`${p}/`))
        if (hit) {
          const suffix = raw.startsWith(hit) ? raw.slice(hit.length) : '/'
          const dest = `/${DEFAULT_SLUG}${hit}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
          const normalized = dest.endsWith('/') || dest.includes('.') ? dest : `${dest}/`
          res.statusCode = 301
          res.setHeader('Location', `${normalized}${qs}`)
          res.end()
          return
        }
        return next()
      }

      const appHtml = resolveAppHtml(serverRoot, rest === '/' ? '/' : rest)
      if (!appHtml) return next()

      try {
        const html = readFileSync(appHtml, 'utf8')
        const send = (body: string) => {
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(body)
        }
        if (transform) {
          transform(raw, html).then(send).catch((err) => next(err))
        } else {
          send(html)
        }
      } catch (err) {
        next(err)
      }
    }
  }

  return {
    name: 'locale-dev-middleware',
    configureServer(server) {
      server.middlewares.use(handler(server.config.root, (url, html) => server.transformIndexHtml(url, html)))
    },
    configurePreviewServer(server) {
      // Serve pre-built locale shells from dist when present; otherwise rewrite.
      server.middlewares.use((req, res, next) => {
        if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) return next()
        const raw = req.url.split('?')[0] || '/'
        const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
        if (isPassthrough(raw)) return next()

        const { slug } = stripLocale(raw)
        if (!slug && (raw === '/' || raw === '')) {
          res.statusCode = 301
          res.setHeader('Location', `/${DEFAULT_SLUG}/${qs}`)
          res.end()
          return
        }
        if (!slug) {
          const hit = APP_PREFIXES.find((p) => raw === p || raw === `${p}/` || raw.startsWith(`${p}/`))
          if (hit) {
            const suffix = raw.startsWith(hit) ? raw.slice(hit.length) : '/'
            const dest = `/${DEFAULT_SLUG}${hit}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
            const normalized = dest.endsWith('/') || dest.includes('.') ? dest : `${dest}/`
            res.statusCode = 301
            res.setHeader('Location', `${normalized}${qs}`)
            res.end()
            return
          }
        }
        return next()
      })
    },
  }
}
