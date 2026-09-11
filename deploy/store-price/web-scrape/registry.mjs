import { scrapeAnthropic } from './scrapers/anthropic.mjs'
import { scrapeCursor } from './scrapers/cursor.mjs'
import { scrapeGithubCopilot } from './scrapers/github.mjs'
import { scrapeKimi } from './scrapers/kimi.mjs'
import { scrapeMidjourney } from './scrapers/midjourney.mjs'
import { scrapeOpenAI } from './scrapers/openai.mjs'
import { scrapePerplexity } from './scrapers/perplexity.mjs'
import { scrapeGenericConfirm } from './scrapers/generic.mjs'
import { staticUsdProduct } from './scrapers/static-usd.mjs'
import { fetchText } from './http.mjs'
import { AI_PRODUCTS, getProduct } from '../catalog.mjs'
import { getOfficial } from '../official-web-prices.mjs'

async function scrapeWithFallback(liveFn, fallbackFn) {
  try {
    return await liveFn()
  } catch (e) {
    console.warn('[web-scrape] live failed, fallback', e.message)
    return fallbackFn()
  }
}

/** Dedicated scrapers (run first). */
export const DEDICATED = [
  { id: 'kimi', run: scrapeKimi },
  {
    id: 'openai',
    run: () =>
      scrapeWithFallback(scrapeOpenAI, () => ({
        productIds: ['chatgpt'],
        source: 'fallback:openai',
        url: 'https://openai.com/chatgpt/pricing',
        plans: {
          go_monthly: staticUsdProduct('chatgpt', 'go_monthly', 8).plans.go_monthly,
          plus_monthly: staticUsdProduct('chatgpt', 'plus_monthly', 20).plans.plus_monthly,
          pro_monthly: staticUsdProduct('chatgpt', 'pro_monthly', 100).plans.pro_monthly,
        },
      })),
  },
  {
    id: 'anthropic',
    run: () =>
      scrapeWithFallback(scrapeAnthropic, () => ({
        productIds: ['claude'],
        source: 'fallback:anthropic',
        plans: {
          pro_monthly: {
            ...staticUsdProduct('claude', 'pro_monthly', 20).plans.pro_monthly,
            locals: {
              in: {
                amount: 1999,
                currency: 'INR',
                priceFormatted: '₹1,999',
                tag: 'premium',
                since: '2026-07-14',
                note: '印度网页卢比本地价',
              },
            },
          },
          max_monthly: staticUsdProduct('claude', 'max_monthly', 100).plans.max_monthly,
          max_20x_monthly: staticUsdProduct('claude', 'max_20x_monthly', 200).plans
            .max_20x_monthly,
        },
      })),
  },
  {
    id: 'cursor',
    run: () =>
      scrapeWithFallback(scrapeCursor, () => ({
        productIds: ['cursor'],
        source: 'fallback:cursor',
        plans: {
          pro_monthly: staticUsdProduct('cursor', 'pro_monthly', 20).plans.pro_monthly,
          pro_plus_monthly: staticUsdProduct('cursor', 'pro_plus_monthly', 60).plans
            .pro_plus_monthly,
          ultra_monthly: staticUsdProduct('cursor', 'ultra_monthly', 200).plans
            .ultra_monthly,
        },
      })),
  },
  {
    id: 'github-copilot',
    run: () =>
      scrapeWithFallback(scrapeGithubCopilot, () => ({
        productIds: ['github-copilot'],
        source: 'fallback:github',
        plans: {
          pro_monthly: staticUsdProduct('github-copilot', 'pro_monthly', 10).plans
            .pro_monthly,
          pro_plus_monthly: staticUsdProduct(
            'github-copilot',
            'pro_plus_monthly',
            39,
          ).plans.pro_plus_monthly,
        },
      })),
  },
  {
    id: 'midjourney',
    run: () =>
      scrapeWithFallback(scrapeMidjourney, () => ({
        productIds: ['midjourney'],
        source: 'fallback:midjourney',
        plans: {
          basic_monthly: staticUsdProduct('midjourney', 'basic_monthly', 10).plans
            .basic_monthly,
          standard_monthly: staticUsdProduct('midjourney', 'standard_monthly', 30).plans
            .standard_monthly,
          pro_monthly: staticUsdProduct('midjourney', 'pro_monthly', 60).plans
            .pro_monthly,
        },
      })),
  },
  {
    id: 'perplexity',
    run: () =>
      scrapeWithFallback(scrapePerplexity, () =>
        staticUsdProduct(
          'perplexity-pro',
          'pro_monthly',
          20,
          'https://www.perplexity.ai/pro',
        ),
      ),
  },
  {
    id: 'gemini',
    run: async () => {
      const url = 'https://one.google.com/ai'
      try {
        await fetchText(url)
      } catch {
        /* page may block; still publish known list price */
      }
      return staticUsdProduct('gemini-advanced', 'advanced_monthly', 19.99, url)
    },
  },
  {
    id: 'microsoft-copilot',
    run: async () =>
      staticUsdProduct(
        'microsoft-copilot-pro',
        'm365_premium_monthly',
        19.99,
        'https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/individuals',
      ),
  },
  {
    id: 'grok',
    run: async () =>
      staticUsdProduct('grok-premium', 'premium_monthly', 30, 'https://x.ai/grok'),
  },
  {
    id: 'poe',
    run: async () =>
      staticUsdProduct('poe-premium', 'premium_monthly', 19.99, 'https://poe.com'),
  },
  {
    id: 'notion',
    run: async () =>
      staticUsdProduct('notion-ai', 'plus_yearly', 10, 'https://www.notion.com/pricing'),
  },
  {
    id: 'elevenlabs',
    run: async () =>
      staticUsdProduct(
        'elevenlabs',
        'starter_monthly',
        6,
        'https://elevenlabs.io/pricing',
      ),
  },
  {
    id: 'suno',
    run: async () => ({
      productIds: ['suno'],
      source: 'static:suno',
      url: 'https://suno.com/pricing',
      plans: {
        pro_monthly: staticUsdProduct('suno', 'pro_monthly', 10).plans.pro_monthly,
        pro_yearly: {
          ...staticUsdProduct('suno', 'pro_yearly', 8).plans.pro_yearly,
          base: {
            ...staticUsdProduct('suno', 'pro_yearly', 8).plans.pro_yearly.base,
            label: 'Pro 年付折合月价',
          },
        },
        premier_monthly: staticUsdProduct('suno', 'premier_monthly', 30).plans
          .premier_monthly,
        premier_yearly: {
          ...staticUsdProduct('suno', 'premier_yearly', 24).plans.premier_yearly,
          base: {
            ...staticUsdProduct('suno', 'premier_yearly', 24).plans.premier_yearly.base,
            label: 'Premier 年付折合月价',
          },
        },
      },
    }),
  },
  {
    id: 'runway',
    run: async () =>
      staticUsdProduct('runway', 'standard_monthly', 15, 'https://runwayml.com/pricing'),
  },
  {
    id: 'grammarly',
    run: async () =>
      staticUsdProduct(
        'grammarly-premium',
        'premium_monthly',
        12,
        'https://www.grammarly.com/plans',
      ),
  },
  {
    id: 'canva',
    run: async () =>
      staticUsdProduct('canva-pro', 'pro_monthly', 14.99, 'https://www.canva.com/pricing/'),
  },
  {
    id: 'duolingo',
    run: async () =>
      staticUsdProduct(
        'duolingo-max',
        'max_monthly',
        29.99,
        'https://www.duolingo.com/super',
      ),
  },
  // 国内官网公开价（静态快照；有独立帮助页的优先用专用 scraper，如 kimi）
  {
    id: 'doubao',
    run: async () => ({
      productIds: ['doubao'],
      source: 'static:doubao',
      url: 'https://www.doubao.com',
      plans: {
        plus_monthly: {
          base: {
            amount: 39.9,
            currency: 'CNY',
            priceFormatted: '¥39.9/月',
            label: '官网标价（人民币）',
          },
          locals: {},
        },
      },
    }),
  },
  {
    id: 'qwen',
    run: async () => ({
      productIds: ['qwen'],
      source: 'static:qwen',
      url: 'https://tongyi.aliyun.com',
      plans: {
        plus_monthly: {
          base: {
            amount: 39.9,
            currency: 'CNY',
            priceFormatted: '¥39.9/月',
            label: '官网标价（人民币）',
          },
          locals: {},
        },
      },
    }),
  },
  {
    id: 'zhipu',
    run: async () => ({
      productIds: ['zhipu-glm'],
      source: 'static:zhipu',
      url: 'https://chatglm.cn',
      plans: {
        plus_monthly: {
          base: {
            amount: 49,
            currency: 'CNY',
            priceFormatted: '¥49/月',
            label: '官网标价（人民币）',
          },
          locals: {},
        },
      },
    }),
  },
  {
    id: 'ernie',
    run: async () => ({
      productIds: ['ernie-bot'],
      source: 'static:ernie',
      url: 'https://yiyan.baidu.com',
      plans: {
        plus_monthly: {
          base: {
            amount: 49.9,
            currency: 'CNY',
            priceFormatted: '¥49.9/月',
            label: '官网标价（人民币）',
          },
          locals: {},
        },
      },
    }),
  },
  {
    id: 'kling',
    run: async () => ({
      productIds: ['kling'],
      source: 'static:kling',
      url: 'https://klingai.com',
      plans: {
        standard_monthly: {
          base: {
            amount: 66,
            currency: 'CNY',
            priceFormatted: '¥66/月',
            label: '官网标价（人民币）',
          },
          locals: {},
        },
      },
    }),
  },
  {
    id: 'capcut',
    run: async () => ({
      productIds: ['capcut-pro'],
      source: 'static:capcut',
      url: 'https://www.capcut.com',
      plans: {
        pro_monthly: {
          base: { amount: 7.99, currency: 'USD', priceFormatted: '$7.99' },
          locals: {
            cn: {
              amount: 25,
              currency: 'CNY',
              priceFormatted: '¥25',
              tag: 'local',
              note: '国内网页/剪映标价',
            },
          },
        },
      },
    }),
  },
]

/**
 * Products covered by dedicated scrapers (skip generic for these ids).
 */
export function dedicatedProductIds() {
  return new Set([
    'kimi',
    'chatgpt',
    'claude',
    'cursor',
    'github-copilot',
    'midjourney',
    'perplexity-pro',
    'gemini-advanced',
    'microsoft-copilot-pro',
    'grok-premium',
    'poe-premium',
    'notion-ai',
    'elevenlabs',
    'suno',
    'runway',
    'grammarly-premium',
    'canva-pro',
    'duolingo-max',
    'doubao',
    'qwen',
    'zhipu-glm',
    'ernie-bot',
    'kling',
    'capcut-pro',
  ])
}

/**
 * Generic confirm for catalog products with curated plans + pricingUrl.
 * Skips dedicated scraper product ids (they already ran live/fallback).
 */
export function buildGenericJobs(curatedBundle, { skip = dedicatedProductIds(), onlySet = null } = {}) {
  const jobs = []
  for (const product of AI_PRODUCTS) {
    const productId = product.productId
    if (skip.has(productId)) continue
    if (onlySet && !onlySet.has(productId) && !onlySet.has(`generic:${productId}`)) continue
    const plans = curatedBundle?.[productId]
    if (!plans || typeof plans !== 'object') continue
    const hasPlan = Object.keys(plans).some((k) => !k.startsWith('_') && plans[k]?.base)
    if (!hasPlan) continue
    const official = getOfficial(productId)
    if (official?.status === 'missing') continue
    const url =
      product?.channels?.web?.pricingUrl ||
      official?.pricingUrl ||
      curatedBundle._meta?.byProduct?.[productId]?.pricingUrl
    if (!url) continue
    jobs.push({
      id: `generic:${productId}`,
      productId,
      run: () => scrapeGenericConfirm(productId, url, plans),
    })
  }
  return jobs
}
