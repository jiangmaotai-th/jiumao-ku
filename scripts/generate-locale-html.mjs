/**
 * Post-build: generate locale-prefixed HTML shells with lang/title/description/hreflang.
 * Scripts/CSS stay absolute (/assets/...).
 *
 * Run after vite build: node scripts/generate-locale-html.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')

const LOCALES = [
  'zh-CN',
  'zh-TW',
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
]

const LOCALE_TO_SLUG = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  hi: 'hi',
  th: 'th',
  ru: 'ru',
  pt: 'pt',
}

const DEFAULT_SLUG = 'zh-cn'

const PAGES = [
  { path: '/', source: 'index.html', titleKey: 'meta.title', descKey: 'meta.description' },
  { path: '/moyee/', source: 'moyee/index.html', titleKey: 'moyee.metaTitle', descKey: 'moyee.metaDescription' },
  { path: '/ebook/', source: 'ebook/index.html', titleKey: 'ebook.metaTitle', descKey: 'ebook.metaDescription' },
  { path: '/image/', source: 'image/index.html', titleKey: 'image.metaTitle', descKey: 'image.metaDescription' },
  { path: '/store/', source: 'store/index.html', titleKey: 'store.metaTitle', descKey: 'store.metaDescription' },
  { path: '/switch/', source: 'switch/index.html', titleKey: 'switchApp.metaTitle', descKey: 'switchApp.metaDescription' },
  { path: '/legal/', source: 'legal/index.html', titleKey: 'legal.metaTitle', descKey: 'legal.metaDescription' },
  { path: '/markdown/', source: 'markdown/index.html', titleKey: 'markdown.metaTitle', descKey: 'markdown.metaDescription' },
  {
    path: '/platform-crop/',
    source: 'platform-crop/index.html',
    titleKey: 'platformCrop.metaTitle',
    descKey: 'platformCrop.metaDescription',
  },
  {
    path: '/video-mute/',
    source: 'video-mute/index.html',
    titleKey: 'videoMute.metaTitle',
    descKey: 'videoMute.metaDescription',
  },
  {
    path: '/scratch/',
    source: 'scratch/index.html',
    titleKey: 'scratch.metaTitle',
    descKey: 'scratch.metaDescription',
  },
  {
    path: '/tank/',
    source: 'tank/index.html',
    titleKey: 'tank.metaTitle',
    descKey: 'tank.metaDescription',
  },
  // AI 日报页。文案在 src/i18n/aiDaily.ts（不进共享 locales 包），loadMessages 里合并为 aiDaily.*
  {
    path: '/ai/',
    source: 'ai/index.html',
    titleKey: 'aiDaily.metaTitle',
    descKey: 'aiDaily.metaDescription',
  },
  // AI 竞技场。文案在 src/i18n/arena.ts，loadMessages 里合并为 arena.*
  {
    path: '/arena/',
    source: 'arena/index.html',
    titleKey: 'arena.metaTitle',
    descKey: 'arena.metaDescription',
  },
]

function lookup(dict, path) {
  const parts = path.split('.')
  let cur = dict
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function withLocalePath(appPath, slug) {
  if (appPath === '/') return `/${slug}/`
  return `/${slug}${appPath}`
}

function escapeAttr(s) {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function buildHreflang(appPath) {
  const links = LOCALES.map((locale) => {
    const slug = LOCALE_TO_SLUG[locale]
    const href = withLocalePath(appPath, slug)
    return `    <link rel="alternate" hreflang="${locale}" href="https://maotaiworks.com${href}" />`
  })
  links.push(
    `    <link rel="alternate" hreflang="x-default" href="https://maotaiworks.com${withLocalePath(appPath, DEFAULT_SLUG)}" />`,
  )
  return links.join('\n')
}

function patchHtml(html, { locale, slug, title, description, appPath }) {
  let out = html

  if (/<html\s[^>]*lang=/i.test(out)) {
    out = out.replace(/<html(\s[^>]*)lang="[^"]*"/i, `<html$1lang="${locale}"`)
  } else {
    out = out.replace(/<html/i, `<html lang="${locale}"`)
  }

  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`)
  }

  if (description) {
    const descTag = `<meta name="description" content="${escapeAttr(description)}" />`
    const before = out
    // Prefer precise patterns so we never swallow charset/viewport metas.
    out = out.replace(
      /<meta\s+name=["']description["']\s+content="[^"]*"\s*\/?>/i,
      descTag,
    )
    if (out === before) {
      out = out.replace(
        /<meta\s*\n\s*name=["']description["']\s*\n\s*content="[^"]*"\s*\n\s*\/?>/i,
        descTag,
      )
    }
    if (out === before && !/name=["']description["']/i.test(out)) {
      out = out.replace(/<\/head>/i, `    ${descTag}\n  </head>`)
    } else if (out === before) {
      // Last resort: only match a meta whose opening tag contains name=description
      out = out.replace(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*\/?>/i, descTag)
    }
  }

  out = out.replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '')
  out = out.replace(/\s*<link\s+rel="alternate"[^>]*>/gi, '')
  const canonical = `    <link rel="canonical" href="https://maotaiworks.com${withLocalePath(appPath, slug)}" />`
  const hreflang = buildHreflang(appPath)
  out = out.replace(/<\/head>/i, `${canonical}\n${hreflang}\n  </head>`)

  out = out.replace(/href="\/"/g, `href="/${slug}/"`)
  out = out.replace(/href="\/legal\//g, `href="/${slug}/legal/`)

  return out
}

function writeShell(relPath, content) {
  const full = join(dist, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

async function loadMessages() {
  const server = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
  })
  try {
    const mod = await server.ssrLoadModule('/src/i18n/locales/index.ts')
    const ai = await server.ssrLoadModule('/src/i18n/aiDaily.ts')
    const arena = await server.ssrLoadModule('/src/i18n/arena.ts')
    const merged = {}
    for (const [locale, dict] of Object.entries(mod.messages)) {
      merged[locale] = { ...dict, aiDaily: ai.aiDailyMessages[locale], arena: arena.arenaMessages[locale] }
    }
    return merged
  } finally {
    await server.close()
  }
}

async function main() {
  if (!existsSync(dist)) {
    console.error('dist/ missing — run vite build first')
    process.exit(1)
  }

  console.log('Loading locale messages via Vite SSR…')
  const messages = await loadMessages()

  let count = 0
  for (const page of PAGES) {
    const sourcePath = join(dist, page.source)
    if (!existsSync(sourcePath)) {
      console.warn('skip missing', page.source)
      continue
    }
    const baseHtml = readFileSync(sourcePath, 'utf8')

    for (const locale of LOCALES) {
      const slug = LOCALE_TO_SLUG[locale]
      const dict = messages[locale] || messages.en
      const title = lookup(dict, page.titleKey) || lookup(messages.en, page.titleKey) || ''
      const description = lookup(dict, page.descKey) || lookup(messages.en, page.descKey) || ''
      const html = patchHtml(baseHtml, { locale, slug, title, description, appPath: page.path })
      const fixed =
        page.path === '/'
          ? `${slug}/index.html`
          : `${slug}${page.path}index.html`.replace(/\/{2,}/g, '/')
      writeShell(fixed, html)
      count++
    }
  }

  console.log(`Generated ${count} locale HTML shells under dist/{locale}/`)

  // Keep /goose/ in source for local play, but do not ship the unpublished game.
  rmSync(join(dist, 'goose'), { recursive: true, force: true })
  for (const slug of Object.values(LOCALE_TO_SLUG)) {
    rmSync(join(dist, slug, 'goose'), { recursive: true, force: true })
  }

  // sitemap.xml (all locale × page URLs)
  const urls = []
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const slug = LOCALE_TO_SLUG[locale]
      urls.push(`https://maotaiworks.com${withLocalePath(page.path, slug)}`)
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`
  writeFileSync(join(dist, 'sitemap.xml'), sitemap)
  writeFileSync(join(root, 'public', 'sitemap.xml'), sitemap)
  console.log(`Wrote sitemap.xml (${urls.length} URLs)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
