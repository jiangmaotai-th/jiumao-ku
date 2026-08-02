/**
 * Official public web/desktop list prices for all catalog products.
 * Used to seed web-prices.json and nightly confirm against pricingUrl.
 * status: 'priced' | 'missing' — missing = no reliable public web subscription.
 * Multi-tier overlays: plan-expansions.mjs (applied at end of this file).
 */
import { applyPlanExpansions } from './plan-expansions.mjs'
function usd(amount, label) {
  const n = Number(amount)
  return {
    base: {
      amount: n,
      currency: 'USD',
      priceFormatted: `$${n % 1 ? n.toFixed(2) : n.toFixed(2)}`,
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
      priceFormatted: Number.isInteger(n) ? `¥${n}` : `¥${n}`,
      label: label || '官网标价（人民币）',
    },
    locals: {},
  }
}

function eur(amount, label) {
  const n = Number(amount)
  return {
    base: {
      amount: n,
      currency: 'EUR',
      priceFormatted: `€${n.toFixed(2)}`,
      ...(label ? { label } : {}),
    },
    locals: {},
  }
}

function entry(pricingUrl, plans, extra = {}) {
  return {
    pricingUrl: pricingUrl || null,
    plans,
    planKeys: Object.keys(plans || {}),
    status: 'priced',
    ...extra,
  }
}

function missing(note) {
  return {
    pricingUrl: null,
    plans: null,
    planKeys: [],
    status: 'missing',
    note: note || '暂无稳定公开的网页订阅标价',
  }
}

/** @type {Record<string, { pricingUrl: string|null, plans: object|null, planKeys: string[], status: string, note?: string }>} */
const OFFICIAL_WEB_PRICES_BASE = {
  // —— chat ——
  chatgpt: entry('https://openai.com/chatgpt/pricing', {
    go_monthly: usd(8, '全球统一标价（公开定价）'),
    plus_monthly: usd(20, '全球统一标价（公开定价）'),
    pro_monthly: usd(200, '全球统一标价（公开定价）'),
  }),
  claude: entry('https://claude.com/pricing', {
    pro_monthly: {
      ...usd(20, '全球统一标价（公开定价）'),
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
    max_monthly: usd(100, 'Max 5x 全球统一标价'),
    max_20x_monthly: usd(200, 'Max 20x 全球统一标价'),
  }),
  'gemini-advanced': entry('https://one.google.com/ai', {
    advanced_monthly: usd(19.99, 'Google One AI Premium 公开标价'),
  }),
  'grok-premium': entry('https://x.ai/grok', {
    premium_monthly: usd(30, 'SuperGrok 公开标价'),
  }),
  'perplexity-pro': entry('https://www.perplexity.ai/pro', {
    pro_monthly: usd(20, '全球统一标价（公开定价）'),
  }),
  'microsoft-copilot-pro': entry(
    'https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/individuals',
    {
      m365_personal_monthly: usd(9.99, 'Microsoft 365 Personal 月付'),
      m365_premium_monthly: usd(19.99, 'Microsoft 365 Premium 月付（取代独立 Copilot Pro）'),
    },
  ),
  'poe-premium': entry('https://poe.com/premium', {
    premium_monthly: usd(19.99, 'Poe 公开标价'),
  }),
  'pi-premium': missing('Pi 以免费/邀请为主，无稳定公开网页订阅档'),
  'character-ai-plus': entry('https://character.ai/subscription', {
    plus_monthly: usd(9.99, 'c.ai+ 公开标价'),
  }),
  'replika-pro': entry('https://replika.com/pro', {
    pro_monthly: usd(19.99, 'Replika Pro 公开标价'),
  }),
  'mistral-le-chat': entry('https://mistral.ai/products/le-chat', {
    pro_monthly: eur(14.99, 'Le Chat Pro 公开标价'),
  }),
  'huggingface-pro': entry('https://huggingface.co/pricing', {
    pro_monthly: usd(9, 'Hugging Face Pro 公开标价'),
  }),
  'zhipu-glm': entry('https://chatglm.cn', {
    plus_monthly: cny(49),
  }),
  'ernie-bot': entry('https://yiyan.baidu.com', {
    plus_monthly: cny(49.9),
  }),
  'qwen': entry('https://tongyi.aliyun.com', {
    plus_monthly: cny(39.9),
  }),
  'doubao': entry('https://www.doubao.com', {
    plus_monthly: cny(39.9),
  }),
  kimi: entry('https://www.kimi.com/zh-cn/help/membership/membership-pricing', {
    andante_monthly: cny(49),
    andante_yearly: cny(39, '连续包年折合月价（年付 ¥468）'),
    moderato_monthly: cny(99),
    moderato_yearly: cny(79, '连续包年折合月价（年付 ¥948）'),
    allegretto_monthly: cny(199),
    allegretto_yearly: cny(159, '连续包年折合月价（年付 ¥1,908）'),
    allegro_monthly: cny(699),
    allegro_yearly: cny(559, '连续包年折合月价（年付 ¥6,708）'),
  }),
  sparkdesk: entry('https://xinghuo.xfyun.cn', {
    plus_monthly: cny(36),
  }),
  hunyuan: entry('https://hunyuan.tencent.com', {
    plus_monthly: cny(48),
  }),
  'minimax-hailuo': entry('https://www.minimaxi.com', {
    plus_monthly: cny(49),
  }),
  stepfun: entry('https://platform.stepfun.com/docs/zh/step-plan/overview', {
    flash_mini_monthly: cny(49, 'Flash Mini 月付'),
  }),

  // —— coding ——
  cursor: entry('https://www.cursor.com/pricing', {
    pro_monthly: usd(20, '全球统一标价（公开定价）'),
    pro_plus_monthly: usd(60, '全球统一标价（公开定价）'),
    ultra_monthly: usd(200, '全球统一标价（公开定价）'),
  }),
  'github-copilot': entry('https://github.com/features/copilot#pricing', {
    pro_monthly: usd(10, '全球统一标价（公开定价）'),
    pro_plus_monthly: usd(39, '全球统一标价（公开定价）'),
  }),
  'windsurf-pro': entry('https://windsurf.com/pricing', {
    pro_monthly: usd(15, 'Windsurf Pro 公开标价'),
  }),
  'claude-code': entry('https://www.anthropic.com/claude-code', {
    code_monthly: usd(20, '随 Claude Pro 档位；公开标价对齐 Pro'),
  }),
  'jetbrains-ai-pro': entry('https://www.jetbrains.com/ai/', {
    pro_monthly: usd(10, 'JetBrains AI Pro 公开标价'),
  }),
  'tabnine-pro': entry('https://www.tabnine.com/pricing', {
    pro_monthly: usd(12, 'Tabnine Dev / Pro 公开标价'),
  }),
  'replit-core': entry('https://replit.com/pricing', {
    core_monthly: usd(25, 'Replit Core 公开标价'),
  }),
  'amazon-q': entry('https://aws.amazon.com/q/developer/pricing/', {
    pro_monthly: usd(19, 'Amazon Q Developer Pro 公开标价'),
  }),
  'sourcegraph-cody': entry('https://sourcegraph.com/pricing', {
    pro_monthly: usd(9, 'Cody Pro 公开标价'),
  }),
  devin: entry('https://devin.ai', {
    monthly: usd(500, 'Devin 公开标价（团队席位）'),
  }),
  'augment-code': entry('https://www.augmentcode.com/pricing', {
    pro_monthly: usd(50, 'Augment 公开入门档'),
  }),
  supermaven: entry('https://supermaven.com/pricing', {
    pro_monthly: usd(10, 'Supermaven Pro 公开标价'),
  }),
  v0: entry('https://v0.dev/pricing', {
    premium_monthly: usd(20, 'v0 Premium 公开标价'),
  }),
  'bolt-new': entry('https://bolt.new/pricing', {
    pro_monthly: usd(25, 'Bolt Pro 公开标价'),
  }),
  lovable: entry('https://lovable.dev/pricing', {
    pro_monthly: usd(25, 'Lovable Pro 公开标价'),
  }),

  // —— image ——
  midjourney: entry('https://docs.midjourney.com/hc/en-us/articles/27870432059405-Compare-Plans', {
    basic_monthly: usd(10),
    standard_monthly: usd(30),
    pro_monthly: usd(60),
  }),
  'adobe-firefly': entry('https://www.adobe.com/products/firefly.html', {
    standard_monthly: usd(9.99, 'Firefly Standard 公开标价'),
  }),
  'leonardo-ai': entry('https://leonardo.ai/pricing', {
    apprentice_monthly: usd(12, 'Apprentice 公开标价'),
    artisan_monthly: usd(30, 'Artisan 公开标价'),
  }),
  ideogram: entry('https://ideogram.ai/pricing', {
    plus_monthly: usd(8, 'Ideogram Plus 公开标价'),
  }),
  'flux-pro': entry('https://bfl.ai/pricing', {
    pro_monthly: usd(12, 'BFL / FLUX 公开入门档（按量档位折合参考）'),
  }),
  'canva-pro': entry('https://www.canva.com/pricing/', {
    pro_monthly: usd(14.99, 'Canva Pro 公开标价'),
  }),
  'krea-ai': entry('https://www.krea.ai/pricing', {
    pro_monthly: usd(35, 'Krea Pro 公开标价'),
  }),
  'magnific-ai': entry('https://magnific.ai/pricing', {
    pro_monthly: usd(39, 'Magnific 公开标价'),
  }),
  'topaz-photo-ai': entry('https://www.topazlabs.com/topaz-photo-ai', {
    monthly: usd(16.66, '订阅折合月价（公开标价）'),
  }),
  'luminar-neo': entry('https://skylum.com/luminar', {
    pro_monthly: usd(14.95, 'Luminar Neo 订阅公开标价'),
  }),
  photoroom: entry('https://www.photoroom.com/pricing', {
    pro_monthly: usd(12.99, 'PhotoRoom Pro 公开标价'),
  }),
  clipdrop: entry('https://clipdrop.co/pricing', {
    pro_monthly: usd(9, 'Clipdrop Pro 公开标价'),
  }),
  'playground-ai': entry('https://playground.com/pricing', {
    pro_monthly: usd(15, 'Playground Pro 公开标价'),
  }),
  'recraft-ai': entry('https://www.recraft.ai/pricing', {
    pro_monthly: usd(25, 'Recraft Pro 公开标价'),
  }),

  // —— video ——
  runway: entry('https://runwayml.com/pricing', {
    standard_monthly: usd(15, 'Standard 公开标价'),
    pro_monthly: usd(35, 'Pro 公开标价'),
  }),
  pika: entry('https://pika.art/pricing', {
    standard_monthly: usd(10, 'Standard 公开标价'),
    pro_monthly: usd(28, 'Pro 公开标价'),
  }),
  'luma-dream-machine': entry('https://lumalabs.ai/dream-machine/pricing', {
    standard_monthly: usd(9.99, 'Standard 公开标价'),
    pro_monthly: usd(29.99, 'Pro 公开标价'),
  }),
  sora: entry('https://openai.com/sora', {
    plus_monthly: usd(20, 'Sora 随 ChatGPT Plus；公开对齐 Plus'),
  }),
  heygen: entry('https://www.heygen.com/pricing', {
    creator_monthly: usd(29, 'Creator 公开标价'),
  }),
  kling: entry('https://klingai.com/pricing', {
    standard_monthly: cny(66),
  }),
  seedance: entry('https://jimeng.jianying.com', {
    plus_monthly: cny(75),
  }),
  vidu: entry('https://www.vidu.com/pricing', {
    plus_monthly: cny(69),
  }),
  synthesia: entry('https://www.synthesia.io/pricing', {
    starter_monthly: usd(29, 'Starter 公开标价'),
  }),
  'd-id': entry('https://www.d-id.com/pricing', {
    lite_monthly: usd(5.99, 'Lite 公开标价'),
  }),
  colossyan: entry('https://www.colossyan.com/pricing', {
    starter_monthly: usd(27, 'Starter 公开标价'),
  }),
  'invideo-ai': entry('https://invideo.io/pricing/', {
    plus_monthly: usd(25, 'Plus 公开标价'),
  }),
  captions: entry('https://www.captions.ai/pricing', {
    pro_monthly: usd(9.99, 'Pro 公开标价'),
  }),
  descript: entry('https://www.descript.com/pricing', {
    hobbyist_monthly: usd(24, 'Hobbyist 公开标价'),
  }),
  'opus-clip': entry('https://www.opus.pro/pricing', {
    pro_monthly: usd(29, 'Pro 公开标价'),
  }),
  'veed-io': entry('https://www.veed.io/pricing', {
    pro_monthly: usd(24, 'Pro 公开标价'),
  }),
  'capcut-pro': entry('https://www.capcut.com/pricing', {
    pro_monthly: {
      ...usd(7.99),
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
  }),
  pixverse: entry('https://pixverse.ai/pricing', {
    standard_monthly: usd(10, '标准版公开标价'),
    pro_monthly: usd(30, '专业版公开标价'),
    premium_monthly: usd(60, '尊享版公开标价'),
    ultimate_monthly: usd(199, '至尊版公开标价'),
    team_ultimate_monthly: usd(99, '团队至尊版公开标价'),
  }),
  'hailuo-video': entry('https://hailuoai.video', {
    plus_monthly: cny(69),
  }),
  qingying: entry('https://chatglm.cn/video', {
    plus_monthly: cny(49),
  }),

  // —— audio ——
  suno: entry('https://suno.com/pricing', {
    pro_monthly: usd(10, 'Pro 月付公开标价'),
    pro_yearly: usd(8, 'Pro 年付折合月价'),
    premier_monthly: usd(30, 'Premier 月付公开标价'),
    premier_yearly: usd(24, 'Premier 年付折合月价'),
  }),
  udio: entry('https://www.udio.com/pricing', {
    standard_monthly: usd(10, 'Standard 公开标价'),
  }),
  elevenlabs: entry('https://elevenlabs.io/pricing', {
    starter_monthly: usd(5, 'Starter 公开标价'),
  }),
  aiva: entry('https://www.aiva.ai/pricing', {
    standard_monthly: eur(15, 'Standard 公开标价'),
  }),
  boomy: entry('https://boomy.com/pricing', {
    creator_monthly: usd(9.99, 'Creator 公开标价'),
  }),
  soundraw: entry('https://soundraw.io/pricing', {
    creator_monthly: usd(16.99, 'Creator 公开标价'),
  }),
  mubert: entry('https://mubert.com/render/pricing', {
    creator_monthly: usd(14, 'Creator 公开标价'),
  }),
  'murf-ai': entry('https://murf.ai/pricing', {
    creator_monthly: usd(29, 'Creator 公开标价'),
  }),
  'play-ht': entry('https://play.ht/pricing/', {
    creator_monthly: usd(39, 'Creator 公开标价'),
  }),
  speechify: entry('https://speechify.com/pricing/', {
    premium_monthly: usd(11.99, 'Premium 公开标价（月付入口）'),
  }),

  // —— writing ——
  'notion-ai': entry('https://www.notion.so/pricing', {
    ai_monthly: usd(10, 'Notion AI add-on 公开标价'),
  }),
  'grammarly-premium': entry('https://www.grammarly.com/plans', {
    premium_monthly: usd(12, 'Premium 公开标价'),
  }),
  jasper: entry('https://www.jasper.ai/pricing', {
    creator_monthly: usd(49, 'Creator 公开标价'),
  }),
  'copy-ai': entry('https://www.copy.ai/pricing', {
    pro_monthly: usd(49, 'Pro 公开标价'),
  }),
  writesonic: entry('https://writesonic.com/pricing', {
    pro_monthly: usd(39, 'Pro 公开标价'),
  }),
  quillbot: entry('https://quillbot.com/premium', {
    premium_monthly: usd(9.95, 'Premium 公开标价'),
  }),
  'deepl-pro': entry('https://www.deepl.com/pro', {
    starter_monthly: usd(8.74, 'Starter 公开标价'),
  }),
  gamma: entry('https://gamma.app/pricing', {
    plus_monthly: usd(10, 'Plus 公开标价'),
  }),
  tome: entry('https://tome.app/pricing', {
    pro_monthly: usd(20, 'Pro 公开标价'),
  }),
  'beautiful-ai': entry('https://www.beautiful.ai/pricing', {
    pro_monthly: usd(12, 'Pro 公开标价'),
  }),
  'taskade-ai': entry('https://www.taskade.com/pricing', {
    pro_monthly: usd(10, 'Pro 公开标价'),
  }),
  'coda-ai': entry('https://coda.io/pricing', {
    pro_monthly: usd(10, 'Pro 公开标价'),
  }),
  'otter-ai': entry('https://otter.ai/pricing', {
    pro_monthly: usd(16.99, 'Pro 公开标价'),
  }),
  'fireflies-ai': entry('https://fireflies.ai/pricing', {
    pro_monthly: usd(18, 'Pro 公开标价'),
  }),
  krisp: entry('https://krisp.ai/pricing/', {
    pro_monthly: usd(8, 'Pro 公开标价'),
  }),

  // —— research ——
  elicit: entry('https://elicit.com/pricing', {
    plus_monthly: usd(10, 'Plus 公开标价'),
  }),
  consensus: entry('https://consensus.app/home/pricing/', {
    premium_monthly: usd(11.99, 'Premium 公开标价'),
  }),
  'you-com': entry('https://you.com/pricing', {
    pro_monthly: usd(20, 'Pro 公开标价'),
  }),

  // —— design ——
  'figma-ai': entry('https://www.figma.com/pricing/', {
    professional_monthly: usd(16, 'Professional 席位公开标价（含 AI 能力）'),
  }),
  'adobe-cc': entry('https://www.adobe.com/creativecloud/plans.html', {
    all_apps_monthly: usd(59.99, 'All Apps 个人版公开标价'),
  }),
  'meitu-ai': entry('https://xiuxiu.meitu.com', {
    vip_monthly: cny(25),
  }),
  wink: entry('https://wink.com', {
    pro_monthly: usd(7.99, 'Wink Pro 公开标价'),
  }),
  'framer-ai': entry('https://www.framer.com/pricing/', {
    pro_monthly: usd(30, 'Pro 公开标价'),
  }),
  'galileo-ai': entry('https://www.usegalileo.ai/pricing', {
    pro_monthly: usd(36, 'Galileo / Stitch 公开标价'),
  }),
  uizard: entry('https://uizard.io/pricing/', {
    pro_monthly: usd(19, 'Pro 公开标价'),
  }),
  looka: entry('https://looka.com/pricing/', {
    basic: usd(20, 'Basic（一次性/年付公开入口价）'),
  }),

  // —— edu ——
  'duolingo-max': entry('https://www.duolingo.com/super', {
    max_monthly: usd(29.99, 'Max 公开标价'),
  }),
  khanmigo: entry('https://www.khanmigo.ai/', {
    monthly: usd(4, 'Khanmigo 公开标价'),
  }),
  'photomath-plus': entry('https://photomath.com/plus', {
    plus_monthly: usd(9.99, 'Plus 公开标价'),
  }),
  'gauth-ai': entry('https://www.gauthmath.com', {
    plus_monthly: usd(11.99, 'Plus 公开标价'),
  }),
  'question-ai': entry('https://www.questionai.com', {
    pro_monthly: usd(9.99, 'Pro 公开标价'),
  }),

  // —— health ——
  calm: entry('https://www.calm.com/pricing', {
    premium_monthly: usd(14.99, 'Premium 公开标价'),
  }),
  headspace: entry('https://www.headspace.com/subscriptions', {
    plus_monthly: usd(12.99, 'Plus 公开标价'),
  }),
  noom: entry('https://www.noom.com', {
    monthly: usd(70, '公开入门档（按计划时长折合参考）'),
  }),
  myfitnesspal: entry('https://www.myfitnesspal.com/premium', {
    premium_monthly: usd(19.99, 'Premium 公开标价'),
  }),

  // —— hardware ——
  'rabbit-r1': missing('硬件设备为主，无稳定独立网页订阅公开档'),
  'humane-ai-pin': missing('产品已停服，无有效公开订阅价'),
  'friend-pendant': missing('硬件预售/设备价为主，无稳定网页订阅档'),
  'meta-rayban-ai': entry('https://www.meta.com/ai/premium/', {
    meta_ai_plus: usd(7.99, 'Meta AI+ 公开标价'),
  }),
}

export const OFFICIAL_WEB_PRICES = applyPlanExpansions(OFFICIAL_WEB_PRICES_BASE)

export function getOfficial(productId) {
  return OFFICIAL_WEB_PRICES[productId] || null
}

/** Plan objects only (for seeding web-prices.json). */
export function officialPlans(productId) {
  const o = getOfficial(productId)
  if (!o || o.status === 'missing' || !o.plans) return null
  return o.plans
}
