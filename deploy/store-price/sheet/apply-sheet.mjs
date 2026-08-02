#!/usr/bin/env node
/**
 * Apply sheet/latest.raw.json →
 *   - sheet/overlay.json (runtime product meta + change notes)
 *   - patch plan-expansions / official prices for known public amounts in 变动说明
 *
 * Daily workflow:
 *   1) python3 sheet/import-sheet.py ~/Desktop/xxx.xlsx
 *   2) node sheet/apply-sheet.mjs
 *   3) node sheet/sync-web-prices.mjs   (optional seed)
 *   4) deploy + refresh products
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSheetProductId, sheetHasFreeTier } from './name-map.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const RAW_PATH = path.join(__dirname, 'latest.raw.json')
const OVERLAY_PATH = path.join(__dirname, 'overlay.json')

function usd(amount, label) {
  const n = Number(amount)
  return {
    base: {
      amount: n,
      currency: 'USD',
      priceFormatted: `$${n.toFixed(2)}`,
      ...(label ? { label } : {}),
    },
    locals: {},
  }
}
function cny(amount, label) {
  const n = Number(amount)
  return {
    base: {
      amount: n,
      currency: 'CNY',
      priceFormatted: `¥${n}`,
      label: label || '官网标价（人民币）',
    },
    locals: {},
  }
}

/**
 * Hard price patches extracted from today's 变动说明 + official public list prices.
 * apply-sheet merges these into PLAN_EXPANSIONS via writing sheet/price-patches.json
 * which plan-expansions.mjs imports.
 */
function buildPricePatches(byId) {
  const patches = {}

  // ChatGPT — Pro 5x $100 between Plus and Pro; Pro $200; Business $25/mo seat
  patches.chatgpt = {
    pricingUrl: 'https://openai.com/chatgpt/pricing',
    plans: {
      go_monthly: usd(5, 'Go 月付'),
      plus_monthly: usd(20, 'Plus 月付'),
      pro_5x_monthly: usd(100, 'Pro 5x 月付'),
      pro_monthly: usd(200, 'Pro 月付'),
      business_monthly: usd(25, 'Business 月付/席'),
      business_yearly: usd(20, 'Business 年付折合月价/席'),
    },
  }

  patches.claude = {
    pricingUrl: 'https://claude.com/pricing',
    plans: {
      pro_monthly: usd(20, 'Pro 月付'),
      max_monthly: usd(100, 'Max 5x 月付'),
      max_20x_monthly: usd(200, 'Max 20x 月付'),
      team_monthly: usd(25, 'Team 月付/席'),
    },
  }

  patches['gemini-advanced'] = {
    pricingUrl: 'https://one.google.com/ai',
    plans: {
      ai_plus_monthly: usd(7.99, 'Google AI Plus'),
      advanced_monthly: usd(19.99, 'AI Pro'),
      spark_monthly: usd(99.99, 'Gemini Spark'),
      ai_ultra_monthly: usd(199.99, 'Google AI Ultra'),
    },
  }

  patches['grok-premium'] = {
    pricingUrl: 'https://x.ai/grok',
    plans: {
      premium_monthly: usd(30, 'SuperGrok'),
      premium_yearly: usd(25, 'SuperGrok 年付折合月价'),
      heavy_monthly: usd(300, 'SuperGrok Heavy'),
    },
  }

  patches['zhipu-glm'] = {
    pricingUrl: 'https://chatglm.cn',
    plans: {
      plus_monthly: cny(49, '智谱会员月付（公开入口）'),
      coding_lite_monthly: cny(118, 'Coding Plan Lite（7/31 后标价）'),
      coding_pro_monthly: cny(538, 'Coding Plan Pro（7/31 后标价）'),
      coding_max_monthly: cny(1078, 'Coding Plan Max（7/31 后标价）'),
    },
  }

  patches.doubao = {
    pricingUrl: 'https://www.doubao.com',
    plans: {
      pro_standard_monthly: cny(68, '标准版'),
      pro_enhanced_monthly: cny(200, '加强版'),
      pro_advanced_monthly: cny(500, '专业版'),
    },
  }

  patches.cursor = {
    pricingUrl: 'https://cursor.com/pricing',
    plans: {
      pro_monthly: usd(20, 'Pro 月付'),
      pro_plus_monthly: usd(60, 'Pro+ 月付'),
      ultra_monthly: usd(200, 'Ultra 月付'),
    },
  }

  patches['github-copilot'] = {
    pricingUrl: 'https://github.com/features/copilot#pricing',
    plans: {
      pro_monthly: usd(10, 'Pro 月付'),
      pro_plus_monthly: usd(39, 'Pro+ 月付'),
      business_monthly: usd(19, 'Business 月付/席'),
      enterprise_monthly: usd(39, 'Enterprise 月付/席'),
    },
  }

  // Sora discontinued — clear subscription plans in patches by marking empty + overlay note
  if (byId.sora) {
    patches.sora = {
      pricingUrl: null,
      plans: {},
      status: 'missing',
      note: byId.sora.statusNote || byId.sora.changeNote || '已停服',
    }
  }

  return patches
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error('缺少', RAW_PATH, '请先运行: python3 sheet/import-sheet.py <xlsx>')
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))
  const byId = {}
  const unmatched = []
  for (const row of raw.products || []) {
    const id = resolveSheetProductId(row.name)
    if (!id) {
      unmatched.push(row.name)
      continue
    }
    byId[id] = {
      productId: id,
      sheetName: row.name,
      category: row.category,
      planStructure: row.planStructure,
      freeTrial: row.freeTrial,
      personalPlans: row.personalPlans,
      teamPlans: row.teamPlans,
      apiPlans: row.apiPlans,
      buyout: row.buyout,
      statusNote: row.statusNote,
      changeNote: row.changeNote,
      hasFreeTier: sheetHasFreeTier(row.freeTrial) || /Hobby/.test(row.planStructure || ''),
      sheetUpdated: raw.updated,
      sheetSource: raw.source,
    }
  }

  const overlay = {
    updated: raw.updated,
    source: raw.source,
    importedAt: new Date().toISOString(),
    unmatched,
    products: byId,
  }
  fs.writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2) + '\n')

  const patches = buildPricePatches(byId)
  const patchPath = path.join(__dirname, 'price-patches.json')
  // Serialize plans as plain amounts for plan-expansions to rehydrate
  const serializable = {}
  for (const [id, p] of Object.entries(patches)) {
    serializable[id] = {
      pricingUrl: p.pricingUrl,
      status: p.status || 'priced',
      note: p.note || '',
      plans: Object.fromEntries(
        Object.entries(p.plans || {}).map(([planId, plan]) => [
          planId,
          {
            amount: plan.base.amount,
            currency: plan.base.currency,
            label: plan.base.label || '',
          },
        ]),
      ),
    }
  }
  fs.writeFileSync(patchPath, JSON.stringify(serializable, null, 2) + '\n')

  console.log(
    JSON.stringify(
      {
        overlayProducts: Object.keys(byId).length,
        withChangeNote: Object.values(byId).filter((p) => p.changeNote).length,
        unmatched,
        pricePatches: Object.keys(patches),
        overlay: OVERLAY_PATH,
        patches: patchPath,
      },
      null,
      2,
    ),
  )
}

main()
