import { expect, test, type Page } from '@playwright/test'

/**
 * Regression for the language switcher freeze.
 *
 * The arena widget used to re-mount inside setLocale's listener loop, which
 * registered another listener while that loop was running and froze the page.
 * These tests switch language only after the widget is mounted, on both the
 * homepage embed and the /arena/ page.
 */

const LOCALES = [
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
] as const

type LocaleSlug = (typeof LOCALES)[number]

const PAGES = [
  { name: '首页', path: '/' },
  { name: '竞技场', path: '/arena/' },
] as const

function localeId(slug: LocaleSlug): string {
  if (slug === 'zh-cn') return 'zh-CN'
  if (slug === 'zh-tw') return 'zh-TW'
  return slug
}

/** Start on a different locale so the click always navigates. */
function sourceSlug(target: LocaleSlug): LocaleSlug {
  return target === 'zh-cn' ? 'en' : 'zh-cn'
}

function localePath(slug: LocaleSlug, pagePath: '/' | '/arena/'): string {
  return pagePath === '/' ? `/${slug}/` : `/${slug}${pagePath}`
}

function normalizePath(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

async function switchLanguage(page: Page, pagePath: '/' | '/arena/', target: LocaleSlug) {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message.split('\n')[0] ?? String(error))
  })
  page.on('crash', () => {
    errors.push('page crashed')
  })

  const source = sourceSlug(target)
  await page.goto(localePath(source, pagePath), {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  })

  await expect(page.locator('.lang-switch__btn')).toBeVisible({ timeout: 45_000 })

  // Mount the arena widget before switching. That is the listener that used to
  // re-enter setLocale and hang the page.
  const embed = page.locator('.arena-embed, [data-arena-host]').first()
  await embed.scrollIntoViewIfNeeded({ timeout: 30_000 })
  await expect(page.locator('.arena-host')).toBeAttached({ timeout: 45_000 })

  const expected = localePath(target, pagePath)
  await page.locator('.lang-switch__btn').click()
  const option = page.locator(`.lang-switch__option[data-locale="${localeId(target)}"]`)
  await expect(option).toBeVisible({ timeout: 15_000 })

  try {
    await Promise.all([
      page.waitForURL((url) => normalizePath(url.pathname) === expected, {
        timeout: 60_000,
        waitUntil: 'domcontentloaded',
      }),
      option.click(),
    ])
  } catch (error) {
    throw new Error(
      `切换到 ${target} 未在时限内完成导航（页面可能卡死）。当前 URL：${page.url()}。${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }

  expect(normalizePath(new URL(page.url()).pathname), 'locale path').toBe(expected)

  const lang = await page.locator('html').getAttribute('lang')
  expect(lang?.toLowerCase(), 'html lang').toBe(target)

  // Destination JS must run and stay responsive. A frozen main thread never
  // paints the switcher and this times out.
  await expect(page.locator('.lang-switch__btn')).toBeVisible({ timeout: 45_000 })
  const alive = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    ready: document.readyState,
  }))
  expect(alive.lang.toLowerCase()).toBe(target)
  expect(alive.ready === 'interactive' || alive.ready === 'complete').toBe(true)
  expect(errors, 'page errors').toEqual([])
}

for (const surface of PAGES) {
  test.describe(surface.name, () => {
    for (const target of LOCALES) {
      test(`切换到 ${target}`, async ({ page }) => {
        await switchLanguage(page, surface.path, target)
      })
    }
  })
}
