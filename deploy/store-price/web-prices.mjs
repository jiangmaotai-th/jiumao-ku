import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STOREFRONT_MAP } from './countries.mjs'
import { ensureFx, toCny } from './fx.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLE_PATH = path.join(__dirname, 'web-prices.json')

/** Local CNY / base CNY < 0.8 → treat as real discount; else premium/parity. */
const DISCOUNT_RATIO = 0.8

function loadRaw() {
  try {
    const j = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'))
    delete j._meta
    return j
  } catch {
    return {}
  }
}

const PLAN_LABELS = {
  plus_monthly: 'Plus 月付',
  pro_monthly: 'Pro 月付',
  pro_yearly: 'Pro 包年',
  premier_monthly: 'Premier 月付',
  premier_yearly: 'Premier 包年',
  pro_plus_monthly: 'Pro+ 月付',
  go_monthly: 'Go 月付',
  max_monthly: 'Max 月付',
  max_20x_monthly: 'Max 20x 月付',
  max_yearly: 'Max 包年',
  // Keep generic — product-specific names (e.g. Gemini AI Pro / 即梦高级会员) come from source labels.
  advanced_monthly: 'Advanced 月付',
  premium_monthly: 'Premium 月付',
  premium_yearly: 'Premium 包年',
  ultra_monthly: 'Ultra 月付',
  basic_monthly: 'Basic 月付',
  standard_monthly: 'Standard 月付',
  standard_yearly: 'Standard 包年',
  ai_monthly: 'AI 月付',
  ai_plus_monthly: 'AI Plus 月付',
  ai_ultra_monthly: 'AI Ultra 月付',
  core_monthly: 'Core 月付',
  core_yearly: 'Core 包年',
  starter_monthly: 'Starter 月付',
  starter_yearly: 'Starter 包年',
  creator_monthly: 'Creator 月付',
  creator_yearly: 'Creator 包年',
  monthly: '月付',
  business_monthly: 'Business 月付',
  business_yearly: 'Business 包年',
  teams_monthly: 'Teams 月付',
  team_monthly: 'Team 月付',
  team_yearly: 'Team 包年',
  mega_monthly: 'Mega 月付',
  maestro_monthly: 'Maestro 月付',
  fancy_monthly: 'Fancy 月付',
  ultimate_monthly: 'Ultimate 月付',
  ultimate_yearly: 'Ultimate 包年',
  team_ultimate_monthly: '团队至尊版 月付',
  team_ultimate_yearly: '团队至尊版 包年',
  advanced_yearly: 'AI Pro 包年',
  basic_yearly: 'Basic 包年',
  mega_yearly: 'Mega 包年',
  apprentice_yearly: 'Apprentice 包年',
  artisan_yearly: 'Artisan 包年',
  maestro_yearly: 'Maestro 包年',
  fancy_yearly: 'Fancy 包年',
  team_premium_monthly: 'Team Premium 月付',
  team_premium_yearly: 'Team Premium 包年',
  teams_standard_monthly: 'Teams Standard 月付',
  teams_premium_monthly: 'Teams Premium 月付',
  code_assistant_yearly: 'Code Assistant 年付折合',
  agentic_yearly: 'Agentic 年付折合',
  premier_yearly: 'Premier 包年',
  ai_yearly: 'AI 包年',
  m365_personal_yearly: 'M365 Personal 包年',
  m365_family_yearly: 'M365 Family 包年',
  professional_yearly: 'Professional 包年',
  organization_yearly: 'Organization 包年',
  photography_yearly: 'Photography 包年',
  all_apps_yearly: 'All Apps 包年',
  scale_yearly: 'Scale 包年',
  unlimited_yearly: 'Unlimited 包年',
  artist_yearly: 'Artist 包年',
  chat_yearly: 'Chat 包年',
  lite_yearly: 'Lite 包年',
  starter_yearly: 'Starter 包年',

  scale_monthly: 'Scale 月付',
  lite_monthly: 'Lite 月付',
  individual_monthly: 'Individual 月付',
  organization_monthly: 'Organization 月付',
  photography_monthly: 'Photography 月付',
  all_apps_pro_monthly: 'All Apps Pro 月付',
  super_monthly: 'Super 月付',
  super_yearly: 'Super 包年',
  plus_yearly: 'Plus 包年',
  max_20x_monthly: 'Max 20x 月付',
  pro_5x_monthly: 'Pro 5x 月付（已并入 Pro）',
  spark_monthly: 'Gemini Spark 月付',
  coding_lite_monthly: 'Coding Plan Lite',
  coding_pro_monthly: 'Coding Plan Pro',
  coding_max_monthly: 'Coding Plan Max',
  business_yearly: 'Business 年付',
  flash_mini_monthly: 'Flash Mini 月付',
  flash_mini_quarterly: 'Flash Mini 季付',
  flash_mini_yearly: 'Flash Mini 包年',
  flash_plus_monthly: 'Flash Plus 月付',
  flash_plus_quarterly: 'Flash Plus 季付',
  flash_plus_yearly: 'Flash Plus 包年',
  flash_pro_monthly: 'Flash Pro 月付',
  flash_pro_quarterly: 'Flash Pro 季付',
  flash_pro_yearly: 'Flash Pro 包年',
  flash_max_monthly: 'Flash Max 月付',
  flash_max_quarterly: 'Flash Max 季付',
  flash_max_yearly: 'Flash Max 包年',
  heavy_monthly: 'Heavy 月付',
  agentic_monthly: 'Agentic 月付',
  chat_monthly: 'Chat 月付',
  agents_monthly: 'Agents 月付',
  professional_monthly: 'Professional 月付',
  vip_auto_monthly: '连续包月',
  vip_month_card: '月卡',
  vip_year_card: '年卡',
  pro_standard_monthly: 'Pro 标准',
  pro_enhanced_monthly: 'Pro 增强',
  pro_advanced_monthly: 'Pro 高阶',
  hobbyist_yearly: 'Hobbyist 包年',
  pro_enhanced: 'Pro 增强',
  youth_monthly: '青春版月付',
  youth_yearly: '青春版包年',
  auto_monthly: '连续包月',
  plus_yearly: 'Plus 包年',
  svip_monthly: 'SVIP 月付',
  vip_yearly: 'VIP 包年',
  artist_monthly: 'Artist 月付',
  unlimited_monthly: 'Unlimited 月付',
  enterprise_monthly: 'Enterprise 月付',
  turbo_monthly: 'Turbo 月付',
  deep_monthly: 'Deep 月付',
  premium: 'Premium',
  yearly: '年付',
  m365_personal_monthly: 'M365 Personal',
  m365_family_monthly: 'M365 Family',
  meta_ai_plus_yearly: 'Meta AI+ 包年',

  // Kimi（月之暗面）四档 × 包月/包年
  andante_monthly: 'Andante 包月',
  andante_yearly: 'Andante 包年',
  moderato_monthly: 'Moderato 包月',
  moderato_yearly: 'Moderato 包年',
  allegretto_monthly: 'Allegretto 包月',
  allegretto_yearly: 'Allegretto 包年',
  allegro_monthly: 'Allegro 包月',
  allegro_yearly: 'Allegro 包年',
  vivace_monthly: 'Vivace 包月',
  vivace_yearly: 'Vivace 包年',
  business_premium_monthly: 'Business Premium 月付',
  business_premium_yearly: 'Business Premium 包年',
  apprentice_monthly: 'Apprentice 月付',
  artisan_monthly: 'Artisan 月付',
  hobbyist_monthly: 'Hobbyist 月付',
  lite_monthly: 'Lite 月付',
  code_monthly: 'Code 月付',
  vip_monthly: 'VIP 月付',
  professional_monthly: 'Professional 月付',
  all_apps_monthly: 'All Apps 月付',
  meta_ai_plus: 'Meta AI+',
  basic: 'Basic',
}

function rowFromAmount(country, amount, currency, priceFormatted, extra = {}) {
  return {
    country,
    amount,
    currency,
    priceFormatted: priceFormatted || `${currency} ${amount}`,
    ...extra,
  }
}

/**
 * New schema per plan:
 * { base: {amount,currency}, locals: { in: {amount,currency,tag,note,since} } }
 * Legacy flat { us: {...}, in: {...} } still accepted but treated as unified+locals.
 */
function normalizePlan(planObj) {
  if (!planObj || typeof planObj !== 'object') return null
  if (planObj.base) {
    return {
      base: planObj.base,
      locals: planObj.locals || {},
    }
  }
  // Legacy: mistaken App Store-style maps — only keep USD/CNY as base, drop PPP noise.
  const entries = Object.entries(planObj)
  const us = planObj.us || planObj.global
  const cn = planObj.cn
  const base = us || cn || (entries[0] && entries[0][1])
  if (!base) return null
  const locals = {}
  for (const [code, row] of entries) {
    const cc = code.toLowerCase()
    if (cc === 'us' || cc === 'global' || cc === 'eu') continue
    if (row?.currency === 'USD') continue
    // Skip classic App Store PPP fingerprints (TRY 299.99, NGN 9500, etc.)
    if (isLikelyAppStorePpp(cc, row)) continue
    locals[cc] = row
  }
  return { base, locals }
}

function isLikelyAppStorePpp(country, row) {
  const amount = Number(row?.amount)
  const cur = row?.currency
  // Known ChatGPT/Claude App Store fingerprint amounts that must never appear on web.
  const fingerprints = [
    ['in', 'INR', 399],
    ['tr', 'TRY', 299.99],
    ['ng', 'NGN', 9500],
    ['id', 'IDR', 169000],
    ['eg', 'EGP', 499],
    ['vn', 'VND', 260000],
    ['ph', 'PHP', 690],
    ['br', 'BRL', 59.9],
    ['th', 'THB', 549],
    ['za', 'ZAR', 299],
  ]
  return fingerprints.some(
    ([c, currency, a]) => c === country && currency === cur && Math.abs(amount - a) < 0.02,
  )
}

function classifyLocal(baseCny, localCny, tag) {
  if (tag === 'premium') return 'premium'
  if (tag === 'discount') return 'discount'
  if (!(baseCny > 0) || !(localCny > 0)) return 'unknown'
  const ratio = localCny / baseCny
  if (ratio < DISCOUNT_RATIO) return 'discount'
  if (ratio > 1.05) return 'premium'
  return 'parity'
}

/** Prefer product-specific source labels so sheet names (黄金会员 / SuperGrok / AI Pro) win over generic PLAN_LABELS. */
function resolvePlanDisplayName(planId, sourceLabel) {
  let label = String(sourceLabel || '')
    .replace(/\s*公开标价.*$/u, '')
    .replace(/\s*（公开入口）\s*$/u, '')
    .replace(/^Google\s+/i, '')
    .trim()
  const weak =
    !label ||
    /官网标价|公开入口|公开标价|入门档|更高用量|更高档|重度档|国内公开|参考$/.test(label)
  if (!weak) {
    if (/月付|包年|年付|季付|连续包|买断|折合|席/.test(label)) return label
    if (/_yearly$/.test(planId)) return `${label} 包年`
    if (/_quarterly$/.test(planId)) return `${label} 季付`
    if (/_monthly$/.test(planId) || planId === 'monthly') return `${label} 月付`
    return label
  }
  return PLAN_LABELS[planId] || planId.replace(/_/g, ' ')
}

/** Build web/desktop price doc: unified base + anomaly locals (NOT App Store PPP table). */
export async function buildWebPriceDoc(productId) {
  const raw = loadRaw()[productId]
  if (!raw || typeof raw !== 'object') {
    return {
      productId,
      channel: 'web',
      pricingModel: 'unified',
      updatedAt: null,
      plans: [],
      byPlan: {},
      planMeta: {},
    }
  }
  const fx = await ensureFx()
  const plans = []
  const byPlan = {}
  const planMeta = {}

  for (const [planId, planObj] of Object.entries(raw)) {
    if (String(planId).startsWith('_')) continue
    const norm = normalizePlan(planObj)
    if (!norm?.base) continue
    plans.push({
      planId,
      name: resolvePlanDisplayName(planId, norm.base.label),
    })

    const baseAmount = Number(norm.base.amount)
    const baseCurrency = norm.base.currency
    const baseCny = toCny(baseAmount, baseCurrency, fx)
    if (baseCny == null) continue

    const baseRow = {
      ...rowFromAmount(
        'us',
        baseAmount,
        baseCurrency,
        norm.base.priceFormatted,
        { kind: 'global', tag: 'global' },
      ),
      cny: baseCny,
      source: 'web_stripe',
      regionName: '全球统一（网页）',
      flag: '🌐',
    }

    byPlan[planId] = { us: baseRow }
    const anomalies = []

    for (const [code, loc] of Object.entries(norm.locals || {})) {
      const country = String(code).toLowerCase()
      const amount = Number(loc.amount)
      const currency = loc.currency
      if (!Number.isFinite(amount) || !currency) continue
      if (isLikelyAppStorePpp(country, loc)) continue
      const cny = toCny(amount, currency, fx)
      if (cny == null) continue
      const vs = classifyLocal(baseCny, cny, loc.tag)
      const ratio = baseCny > 0 ? cny / baseCny : null
      const sf = STOREFRONT_MAP[country]
      const row = {
        ...rowFromAmount(country, amount, currency, loc.priceFormatted, {
          kind: 'local',
          tag: vs,
          since: loc.since || null,
          note: loc.note || null,
        }),
        cny,
        source: 'web_local',
        regionName: sf?.name || country.toUpperCase(),
        flag: sf?.flag || '',
        vsBase: vs,
        ratio,
      }
      byPlan[planId][country] = row
      anomalies.push({
        country,
        regionName: row.regionName,
        flag: row.flag,
        amount,
        currency,
        priceFormatted: row.priceFormatted,
        cny,
        vsBase: vs,
        ratio,
        since: loc.since || null,
        note:
          loc.note ||
          (vs === 'premium'
            ? '本地价≥美区，网页订阅并不便宜'
            : vs === 'discount'
              ? '相对全球美元价更低'
              : '与全球价大致持平'),
      })
    }

    planMeta[planId] = {
      pricingModel: 'unified',
      base: {
        amount: baseAmount,
        currency: baseCurrency,
        priceFormatted: norm.base.priceFormatted || `${baseCurrency} ${baseAmount}`,
        cny: baseCny,
        label:
          norm.base.label ||
          (baseCurrency === 'CNY'
            ? '官网标价（人民币）'
            : '全球统一标价（Stripe / 官网）'),
      },
      anomalies,
      warning:
        anomalies.some((a) => a.vsBase === 'premium')
          ? '部分地区网页本地价含税溢价，可能比美区更贵——低价区通常只存在于 App Store 内购'
          : '网页端多为全球统一美元价，不存在 App Store 那种印度/土耳其骨折区',
    }
  }

  return {
    productId,
    channel: 'web',
    pricingModel: 'unified',
    updatedAt: new Date().toISOString(),
    plans,
    byPlan,
    planMeta,
  }
}

export async function buildDesktopPriceDoc(productId, product) {
  const rawAll = loadRaw()
  const deskKey = `${productId}__desktop`
  if (rawAll[deskKey]) {
    const doc = await buildWebPriceDoc(deskKey)
    return {
      ...doc,
      productId,
      channel: 'desktop',
      note: '桌面端独立标价',
    }
  }
  const store = product?.channels?.desktop?.store
  if (!store || store === 'none') {
    return {
      productId,
      channel: 'desktop',
      pricingModel: 'unified',
      updatedAt: null,
      plans: [],
      byPlan: {},
      planMeta: {},
      note: '该产品无独立桌面分区价（或不适用）',
    }
  }
  const web = await buildWebPriceDoc(productId)
  if (!web.plans?.length) {
    return {
      productId,
      channel: 'desktop',
      pricingModel: 'unified',
      updatedAt: null,
      plans: [],
      byPlan: {},
      planMeta: {},
      note: '暂无桌面标价',
    }
  }
  return {
    ...web,
    productId,
    channel: 'desktop',
    note:
      store === 'mac'
        ? '桌面端通常走官网/Stripe，与网页同价（非 App Store 内购）'
        : '桌面端通常走官网/Stripe，与网页同价',
  }
}
