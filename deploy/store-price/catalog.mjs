/**
 * AI subscription product catalog for /store/ 「AI 订阅低价区查询器」
 * channels.appstore.trackId — App Store scrape when set
 * channels.web — curated / scraped web list prices
 * channels.desktop — mac / ms / none
 *
 * pricingUrl / planKeys may be overlaid from official-web-prices.mjs via getProduct().
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOfficial } from './official-web-prices.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadSheetOverlay() {
  try {
    const p = path.join(__dirname, 'sheet', 'overlay.json')
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

export const CATEGORIES = [
  { id: 'chat', name: '对话 / 大模型' },
  { id: 'coding', name: '编程 / 开发' },
  { id: 'image', name: '图像生成' },
  { id: 'video', name: '视频生成' },
  { id: 'audio', name: '音乐 / 音频' },
  { id: 'writing', name: '写作 / 办公' },
  { id: 'research', name: '搜索 / 研究' },
  { id: 'design', name: '设计 / 其他' },
  { id: 'edu', name: '教育' },
  { id: 'health', name: '生活 / 健康' },
  { id: 'hardware', name: 'AI 硬件订阅' },
]

/**
 * 无个人免费档（仅试用 / 纯付费 / 买断硬件 / 已停服 / 不单独售卖）。
 * 其余目录产品默认 hasFreeTier=true → 前端展示「可免费」。
 */
const NO_FREE_TIER = new Set([
  'midjourney',
  'magnific-ai',
  'noom',
  'topaz-photo-ai',
  'luminar-neo',
  'rabbit-r1',
  'humane-ai-pin',
  'friend-pendant',
  'flux-pro',
  'sora',
  'claude-code',
  'heygen',
  'synthesia',
  'd-id',
  'colossyan',
  'captions',
  'opus-clip',
  'soundraw',
  'jasper',
  'beautiful-ai',
  'galileo-ai',
  'devin',
  'augment-code',
])

function p(id, name, nameZh, category, vendor, channels = {}, extra = {}) {
  const { hasFreeTier: freeOverride, ...restExtra } = extra
  return {
    productId: id,
    name,
    nameZh: nameZh || name,
    category,
    vendor,
    icon: restExtra.icon || '',
    hasFreeTier: freeOverride ?? !NO_FREE_TIER.has(id),
    channels: {
      appstore: channels.appstore || null,
      web: channels.web || { planKeys: ['monthly'] },
      desktop: channels.desktop || { store: 'none' },
    },
    ...restExtra,
  }
}

/** Old product ids → canonical product (plans selected inside the product page). */
export const PRODUCT_ALIASES = {
  'chatgpt-go': 'chatgpt',
  'chatgpt-plus': 'chatgpt',
  'chatgpt-pro': 'chatgpt',
  'claude-pro': 'claude',
  'claude-max': 'claude',
  'claude-max-5x': 'claude',
  'claude-max-20x': 'claude',
  'cursor-pro': 'cursor',
  'cursor-pro-plus': 'cursor',
  'cursor-ultra': 'cursor',
  'github-copilot-pro': 'github-copilot',
  'github-copilot-pro-plus': 'github-copilot',
}

export function resolveProductId(productId) {
  return PRODUCT_ALIASES[productId] || productId
}

/** Homepage featured (fixed order). */
export const HOT_PRODUCTS = [
  'chatgpt',
  'claude',
  'gemini-advanced',
  'cursor',
  'github-copilot',
  'kimi',
  'perplexity-pro',
  'midjourney',
  'notion-ai',
  'grok-premium',
  'microsoft-copilot-pro',
  'kling',
]

/** Homepage / detail 「HOT」flame badge (subset of featured products). */
export const HOT_BADGE_PRODUCTS = new Set([
  'chatgpt',
  'claude',
  'cursor',
  'kimi',
  'gemini-advanced',
  'github-copilot',
])

export function isHotBadgeProduct(productId) {
  return HOT_BADGE_PRODUCTS.has(resolveProductId(productId))
}

export const AI_PRODUCTS = [
  // —— 对话 / 大模型 ——
  p('chatgpt', 'ChatGPT', 'ChatGPT', 'chat', 'OpenAI', {
    appstore: {
      trackId: 6448311069,
      planHints: ['go', 'chatgpt go', 'plus', 'chatgpt plus', 'pro', 'chatgpt pro'],
    },
    web: {
      pricingUrl: 'https://openai.com/chatgpt/pricing',
      planKeys: [
        'go_monthly',
        'plus_monthly',
        'pro_monthly',
        'business_monthly',
        'business_yearly',
        'business_premium_monthly',
        'business_premium_yearly',
      ],
    },
    desktop: { store: 'mac', skuHints: ['plus', 'pro', 'go'] },
  }),
  p('claude', 'Claude', 'Claude', 'chat', 'Anthropic', {
    appstore: {
      trackId: 6473753684,
      planHints: ['pro', 'claude pro', 'max', 'claude max'],
    },
    web: {
      pricingUrl: 'https://claude.com/pricing',
      planKeys: [
        'pro_monthly',
        'pro_yearly',
        'max_monthly',
        'max_20x_monthly',
        'team_monthly',
        'team_yearly',
        'team_premium_monthly',
        'team_premium_yearly',
      ],
    },
    desktop: { store: 'mac', skuHints: ['pro', 'max', 'max 20x'] },
  }),
  p('gemini-advanced', 'Gemini Advanced', 'Gemini Advanced', 'chat', 'Google', {
    appstore: { trackId: 6472530181, planHints: ['advanced', 'gemini', 'google one ai', 'ai plus', 'ai pro', 'ultra'] },
    web: {
      pricingUrl: 'https://gemini.google/subscriptions',
      planKeys: ['ai_plus_monthly', 'advanced_monthly', 'spark_monthly', 'ai_ultra_monthly'],
    },
  }),
  p('grok-premium', 'Grok Premium', 'Grok Premium', 'chat', 'xAI', {
    appstore: { trackId: 333903271, planHints: ['premium', 'grok', 'x premium'] },
    web: { pricingUrl: 'https://x.ai', planKeys: ['premium_monthly'] },
  }),
  p('perplexity-pro', 'Perplexity Pro', 'Perplexity Pro', 'chat', 'Perplexity', {
    appstore: { trackId: 1668000334, planHints: ['pro', 'perplexity pro'] },
    web: { pricingUrl: 'https://www.perplexity.ai/pro', planKeys: ['pro_monthly'] },
  }),
  p('microsoft-copilot-pro', 'Copilot Pro', 'Copilot Pro', 'chat', 'Microsoft', {
    appstore: { trackId: 6472532773, planHints: ['copilot pro', 'pro', 'premium'] },
    web: {
      pricingUrl:
        'https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/individuals',
      planKeys: [
        'm365_premium_monthly',
        'm365_personal_monthly',
        'm365_family_monthly',
        'm365_pro_monthly',
      ],
    },
    desktop: { store: 'ms', skuHints: ['copilot pro', 'microsoft 365 premium'] },
  }),
  p('poe-premium', 'Poe Premium', 'Poe Premium', 'chat', 'Quora', {
    appstore: { trackId: 1559745142, planHints: ['premium', 'poe'] },
    web: { pricingUrl: 'https://poe.com', planKeys: ['premium_monthly'] },
  }),
  p('pi-premium', 'Pi Premium', 'Pi Premium', 'chat', 'Inflection', {
    web: { planKeys: ['premium_monthly'] },
  }),
  p('character-ai-plus', 'Character.AI Plus', 'Character.AI Plus', 'chat', 'Character.AI', {
    appstore: { trackId: 1607652642, planHints: ['c.ai+', 'plus', 'character'] },
    web: {
      pricingUrl: 'https://character.ai/subscribe',
      planKeys: ['plus_monthly', 'plus_yearly'],
    },
  }),
  p('replika-pro', 'Replika Pro', 'Replika Pro', 'chat', 'Luka', {
    appstore: { trackId: 1158555867, planHints: ['pro', 'replika'] },
    web: { planKeys: ['pro_monthly'] },
  }),
  p('mistral-le-chat', 'Mistral Le Chat', 'Mistral（Le Chat）', 'chat', 'Mistral', {
    web: {
      pricingUrl: 'https://mistral.ai/pricing',
      planKeys: ['pro_monthly', 'team_monthly'],
    },
  }),
  p('huggingface-pro', 'Hugging Face Pro', 'Hugging Face Pro', 'chat', 'Hugging Face', {
    web: {
      pricingUrl: 'https://huggingface.co/pricing',
      planKeys: ['pro_monthly', 'team_monthly', 'enterprise_monthly'],
    },
  }),
  p('zhipu-glm', 'Zhipu Qingyan', '智谱清言（GLM）', 'chat', '智谱', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('ernie-bot', 'Ernie Bot', '文心一言', 'chat', '百度', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('qwen', 'Tongyi Qianwen', '通义千问', 'chat', '阿里', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('doubao', 'Doubao', '豆包', 'chat', '字节', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('kimi', 'Kimi', 'Kimi', 'chat', '月之暗面', {
    web: {
      pricingUrl: 'https://www.kimi.ai/help/membership/membership-pricing',
      planKeys: [
        'moderato_monthly',
        'moderato_yearly',
        'allegretto_monthly',
        'allegretto_yearly',
        'allegro_monthly',
        'allegro_yearly',
        'vivace_monthly',
        'vivace_yearly',
      ],
    },
  }),
  p('sparkdesk', 'iFlytek Spark', '讯飞星火', 'chat', '科大讯飞', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('hunyuan', 'Tencent Hunyuan', '腾讯混元', 'chat', '腾讯', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('minimax-hailuo', 'MiniMax Hailuo', '海螺AI（MiniMax）', 'chat', 'MiniMax', {
    web: { planKeys: ['plus_monthly'] },
  }),
  p('stepfun', 'StepFun Yuewen', '跃问（阶跃星辰）', 'chat', '阶跃星辰', {
    web: {
      pricingUrl: 'https://platform.stepfun.com/docs/zh/step-plan/overview',
      planKeys: [
        'flash_mini_monthly',
        'flash_mini_quarterly',
        'flash_mini_yearly',
        'flash_plus_monthly',
        'flash_plus_quarterly',
        'flash_plus_yearly',
        'flash_pro_monthly',
        'flash_pro_quarterly',
        'flash_pro_yearly',
        'flash_max_monthly',
        'flash_max_quarterly',
        'flash_max_yearly',
      ],
    },
  }),

  // —— 编程 / 开发 ——
  p('cursor', 'Cursor', 'Cursor', 'coding', 'Anysphere', {
    web: {
      pricingUrl: 'https://www.cursor.com/pricing',
      planKeys: [
        'pro_monthly',
        'pro_plus_monthly',
        'ultra_monthly',
        'teams_standard_monthly',
        'teams_premium_monthly',
      ],
    },
    desktop: { store: 'none', skuHints: ['pro', 'pro+', 'ultra', 'teams'] },
  }),
  p('github-copilot', 'GitHub Copilot', 'GitHub Copilot', 'coding', 'GitHub', {
    web: {
      pricingUrl: 'https://github.com/features/copilot',
      planKeys: ['pro_monthly', 'pro_plus_monthly', 'max_monthly'],
    },
    desktop: { store: 'none', skuHints: ['copilot'] },
  }),
  p('windsurf-pro', 'Windsurf Pro', 'Windsurf Pro', 'coding', 'Codeium', {
    web: { pricingUrl: 'https://devin.ai/pricing', planKeys: ['pro_monthly', 'max_monthly'] },
  }),
  p('claude-code', 'Claude Code', 'Claude Code', 'coding', 'Anthropic', {
    web: { planKeys: ['code_monthly'] },
  }),
  p('jetbrains-ai-pro', 'JetBrains AI Pro', 'JetBrains AI Pro', 'coding', 'JetBrains', {
    web: { planKeys: ['pro_monthly'] },
  }),
  p('tabnine-pro', 'Tabnine Pro', 'Tabnine Pro', 'coding', 'Tabnine', {
    web: {
      pricingUrl: 'https://www.tabnine.com/pricing',
      planKeys: ['code_assistant_yearly', 'agentic_yearly'],
    },
  }),
  p('replit-core', 'Replit Core', 'Replit Core', 'coding', 'Replit', {
    web: {
      pricingUrl: 'https://replit.com/pricing',
      planKeys: ['core_monthly', 'core_yearly', 'pro_monthly', 'pro_yearly'],
    },
  }),
  p('amazon-q', 'Amazon Q Developer', 'Amazon Q Developer', 'coding', 'Amazon', {
    web: { planKeys: ['pro_monthly'] },
  }),
  p('sourcegraph-cody', 'Sourcegraph Cody', 'Sourcegraph Cody', 'coding', 'Sourcegraph', {
    web: { planKeys: ['pro_monthly'] },
  }),
  p('devin', 'Devin', 'Devin', 'coding', 'Cognition', {
    web: { pricingUrl: 'https://devin.ai/pricing', planKeys: ['pro_monthly', 'max_monthly'] },
  }),
  p('augment-code', 'Augment Code', 'Augment Code', 'coding', 'Augment', {
    web: { planKeys: ['pro_monthly'] },
  }),
  p('supermaven', 'Supermaven', 'Supermaven', 'coding', 'Supermaven', {
    web: { planKeys: ['pro_monthly'] },
  }),
  p('v0', 'v0', 'v0（Vercel）', 'coding', 'Vercel', {
    web: { pricingUrl: 'https://v0.app/pricing', planKeys: ['plus_monthly', 'business_monthly'] },
  }),
  p('bolt-new', 'Bolt.new', 'Bolt.new', 'coding', 'StackBlitz', {
    web: { planKeys: ['pro_monthly'] },
  }),
  p('lovable', 'Lovable', 'Lovable', 'coding', 'Lovable', {
    web: { planKeys: ['pro_monthly'] },
  }),

  // —— 图像 ——
  p('midjourney', 'Midjourney', 'Midjourney', 'image', 'Midjourney', {
    web: { pricingUrl: 'https://www.midjourney.com/account', planKeys: ['basic_monthly', 'standard_monthly', 'pro_monthly'] },
  }),
  p('adobe-firefly', 'Adobe Firefly', 'Adobe Firefly', 'image', 'Adobe', {
    web: { planKeys: ['standard_monthly'] },
  }),
  p('leonardo-ai', 'Leonardo AI', 'Leonardo AI', 'image', 'Leonardo', {
    web: { planKeys: ['apprentice_monthly'] },
  }),
  p('ideogram', 'Ideogram', 'Ideogram', 'image', 'Ideogram', {
    web: {
      pricingUrl: 'https://ideogram.ai/pricing',
      planKeys: [
        'plus_monthly',
        'plus_yearly',
        'pro_monthly',
        'pro_yearly',
        'team_monthly',
        'team_yearly',
      ],
    },
  }),
  p('flux-pro', 'FLUX Pro', 'FLUX Pro', 'image', 'Black Forest Labs', {
    web: { pricingUrl: 'https://bfl.ai/pricing', planKeys: [] },
  }),
  p('canva-pro', 'Canva Pro', 'Canva Pro', 'image', 'Canva', {
    appstore: { trackId: 1477376905, planHints: ['pro', 'canva pro'] },
    web: { planKeys: ['pro_monthly'] },
  }),
  p('krea-ai', 'Krea AI', 'Krea AI', 'image', 'Krea', {
    web: {
      pricingUrl: 'https://www.krea.ai/pricing',
      planKeys: [
        'basic_monthly',
        'pro_monthly',
        'max_monthly',
        'business_monthly',
        'basic_yearly',
        'pro_yearly',
        'max_yearly',
        'business_yearly',
      ],
    },
  }),
  p('magnific-ai', 'Magnific AI', 'Magnific AI', 'image', 'Magnific', { web: { planKeys: ['pro_monthly'] } }),
  p('topaz-photo-ai', 'Topaz Photo AI', 'Topaz Photo AI', 'image', 'Topaz', { web: { planKeys: ['monthly'] }, desktop: { store: 'none' } }),
  p('luminar-neo', 'Luminar Neo', 'Luminar Neo', 'image', 'Skylum', { web: { planKeys: ['pro_monthly'] } }),
  p('photoroom', 'PhotoRoom', 'PhotoRoom', 'image', 'PhotoRoom', {
    appstore: { trackId: 1455009060, planHints: ['pro', 'photoroom'] },
    web: { planKeys: ['pro_monthly'] },
  }),
  p('clipdrop', 'Clipdrop', 'Clipdrop', 'image', 'Stability', { web: { planKeys: ['pro_monthly'] } }),
  p('playground-ai', 'Playground AI', 'Playground AI', 'image', 'Playground', { web: { planKeys: ['pro_monthly'] } }),
  p('recraft-ai', 'Recraft AI', 'Recraft AI', 'image', 'Recraft', { web: { planKeys: ['pro_monthly'] } }),

  // —— 视频 ——
  p('runway', 'Runway', 'Runway', 'video', 'Runway', {
    web: {
      planKeys: [
        'standard_monthly',
        'standard_yearly',
        'pro_monthly',
        'pro_yearly',
        'max_monthly',
        'max_yearly',
        'team_monthly',
      ],
    },
  }),
  p('pika', 'Pika', 'Pika', 'video', 'Pika', {
    web: {
      pricingUrl: 'https://pika.art/pricing',
      planKeys: [
        'basic_monthly',
        'basic_yearly',
        'standard_monthly',
        'standard_yearly',
        'pro_monthly',
        'pro_yearly',
      ],
    },
  }),
  p('luma-dream-machine', 'Luma Dream Machine', 'Luma Dream Machine', 'video', 'Luma', {
    web: { pricingUrl: 'https://lumalabs.ai/pricing', planKeys: ['plus_monthly', 'pro_monthly', 'ultra_monthly'] },
  }),
  p('sora', 'Sora', 'Sora', 'video', 'OpenAI', { web: { planKeys: ['plus_monthly'] } }),
  p('heygen', 'HeyGen', 'HeyGen', 'video', 'HeyGen', {
    web: {
      pricingUrl: 'https://www.heygen.com/pricing',
      planKeys: [
        'creator_monthly',
        'creator_yearly',
        'pro_monthly',
        'pro_yearly',
        'business_monthly',
        'business_yearly',
      ],
    },
  }),
  p('kling', 'Kling', '可灵（Kling）', 'video', '快手', { web: { planKeys: ['standard_monthly'] } }),
  p('seedance', 'Seedance', '即梦（Seedance）', 'video', '字节', { web: { planKeys: ['plus_monthly'] } }),
  p('vidu', 'Vidu', 'Vidu', 'video', '生数', { web: { planKeys: ['plus_monthly'] } }),
  p('synthesia', 'Synthesia', 'Synthesia', 'video', 'Synthesia', { web: { planKeys: ['starter_monthly'] } }),
  p('d-id', 'D-ID', 'D-ID', 'video', 'D-ID', { web: { planKeys: ['lite_monthly'] } }),
  p('colossyan', 'Colossyan', 'Colossyan', 'video', 'Colossyan', { web: { planKeys: ['starter_monthly'] } }),
  p('invideo-ai', 'InVideo AI', 'InVideo AI', 'video', 'InVideo', { web: { planKeys: ['plus_monthly'] } }),
  p('captions', 'Captions', 'Captions', 'video', 'Captions', {
    appstore: { trackId: 1541027222, planHints: ['pro', 'captions'] },
    web: { planKeys: ['pro_monthly'] },
  }),
  p('descript', 'Descript', 'Descript', 'video', 'Descript', {
    web: {
      pricingUrl: 'https://www.descript.com/pricing',
      planKeys: [
        'hobbyist_monthly',
        'hobbyist_yearly',
        'creator_monthly',
        'creator_yearly',
        'business_monthly',
        'business_yearly',
      ],
    },
  }),
  p('opus-clip', 'Opus Clip', 'Opus Clip', 'video', 'Opus', { web: { planKeys: ['pro_monthly'] } }),
  p('veed-io', 'Veed.io', 'Veed.io', 'video', 'VEED', { web: { planKeys: ['pro_monthly'] } }),
  p('capcut-pro', 'CapCut Pro', 'CapCut Pro（剪映）', 'video', 'ByteDance', {
    appstore: { trackId: 1500855883, planHints: ['pro', 'capcut pro', '剪映'] },
    web: { planKeys: ['pro_monthly'] },
  }),
  p('pixverse', 'PixVerse', 'PixVerse（拍我 AI）', 'video', 'PixVerse', { web: { planKeys: ['standard_monthly', 'pro_monthly', 'premium_monthly', 'ultimate_monthly', 'team_ultimate_monthly'] } }),
  p('hailuo-video', 'Hailuo Video', '海螺视频（Hailuo）', 'video', 'MiniMax', { web: { planKeys: ['plus_monthly'] } }),
  p('qingying', 'Zhipu Qingying', '智谱清影', 'video', '智谱', { web: { planKeys: ['plus_monthly'] } }),

  // —— 音乐 / 音频 ——
  p('suno', 'Suno', 'Suno', 'audio', 'Suno', {
    web: {
      pricingUrl: 'https://suno.com/pricing',
      planKeys: ['pro_monthly', 'pro_yearly', 'premier_monthly', 'premier_yearly'],
    },
  }),
  p('udio', 'Udio', 'Udio', 'audio', 'Udio', { web: { planKeys: ['standard_monthly'] } }),
  p('elevenlabs', 'ElevenLabs', 'ElevenLabs', 'audio', 'ElevenLabs', { web: { planKeys: ['starter_monthly'] } }),
  p('aiva', 'AIVA', 'AIVA', 'audio', 'AIVA', { web: { planKeys: ['standard_monthly'] } }),
  p('boomy', 'Boomy', 'Boomy', 'audio', 'Boomy', { web: { planKeys: ['creator_monthly'] } }),
  p('soundraw', 'Soundraw', 'Soundraw', 'audio', 'Soundraw', { web: { planKeys: ['creator_monthly'] } }),
  p('mubert', 'Mubert', 'Mubert', 'audio', 'Mubert', { web: { planKeys: ['creator_monthly'] } }),
  p('murf-ai', 'Murf AI', 'Murf AI', 'audio', 'Murf', { web: { planKeys: ['creator_monthly'] } }),
  p('play-ht', 'Play.ht', 'Play.ht', 'audio', 'Play.ht', { web: { planKeys: ['creator_monthly'] } }),
  p('speechify', 'Speechify', 'Speechify', 'audio', 'Speechify', {
    appstore: { trackId: 1209815023, planHints: ['premium', 'speechify'] },
    web: { planKeys: ['premium_monthly'] },
  }),

  // —— 写作 / 办公 ——
  p('notion-ai', 'Notion AI', 'Notion AI', 'writing', 'Notion', {
    appstore: { trackId: 1232780281, planHints: ['ai', 'notion ai', 'plus', 'business'] },
    web: {
      pricingUrl: 'https://www.notion.com/pricing',
      planKeys: ['plus_yearly', 'business_yearly', 'plus_monthly', 'business_monthly'],
    },
  }),
  p('grammarly-premium', 'Grammarly Premium', 'Grammarly Premium', 'writing', 'Grammarly', {
    appstore: { trackId: 1158872862, planHints: ['premium', 'grammarly', 'pro'] },
    web: {
      pricingUrl: 'https://www.grammarly.com/plans',
      planKeys: ['premium_monthly', 'premium_yearly'],
    },
  }),
  p('jasper', 'Jasper', 'Jasper', 'writing', 'Jasper', {
    web: { pricingUrl: 'https://www.jasper.ai/pricing', planKeys: ['pro_monthly', 'pro_yearly'] },
  }),
  p('copy-ai', 'Copy.ai', 'Copy.ai', 'writing', 'Copy.ai', { web: { planKeys: ['pro_monthly'] } }),
  p('writesonic', 'Writesonic', 'Writesonic', 'writing', 'Writesonic', { web: { planKeys: ['pro_monthly'] } }),
  p('quillbot', 'QuillBot', 'QuillBot', 'writing', 'QuillBot', {
    appstore: { trackId: 1564792812, planHints: ['premium', 'quillbot'] },
    web: { planKeys: ['premium_monthly'] },
  }),
  p('deepl-pro', 'DeepL Pro', 'DeepL Pro', 'writing', 'DeepL', {
    appstore: { trackId: 1204823543, planHints: ['pro', 'deepl'] },
    web: { planKeys: ['starter_monthly'] },
  }),
  p('gamma', 'Gamma', 'Gamma', 'writing', 'Gamma', { web: { planKeys: ['plus_monthly'] } }),
  p('tome', 'Tome', 'Tome', 'writing', 'Tome', { web: { planKeys: ['pro_monthly'] } }),
  p('beautiful-ai', 'Beautiful.ai', 'Beautiful.ai', 'writing', 'Beautiful.ai', { web: { planKeys: ['pro_monthly'] } }),
  p('taskade-ai', 'Taskade AI', 'Taskade AI', 'writing', 'Taskade', { web: { planKeys: ['pro_monthly'] } }),
  p('coda-ai', 'Coda AI', 'Coda AI', 'writing', 'Coda', { web: { planKeys: ['pro_monthly'] } }),
  p('otter-ai', 'Otter.ai', 'Otter.ai', 'writing', 'Otter', {
    appstore: { trackId: 1276437113, planHints: ['pro', 'otter'] },
    web: { planKeys: ['pro_monthly'] },
  }),
  p('fireflies-ai', 'Fireflies.ai', 'Fireflies.ai', 'writing', 'Fireflies', { web: { planKeys: ['pro_monthly'] } }),
  p('krisp', 'Krisp', 'Krisp', 'writing', 'Krisp', { web: { planKeys: ['pro_monthly'] } }),

  // —— 搜索 / 研究 ——
  p('elicit', 'Elicit', 'Elicit', 'research', 'Elicit', { web: { planKeys: ['plus_monthly'] } }),
  p('consensus', 'Consensus', 'Consensus', 'research', 'Consensus', { web: { planKeys: ['premium_monthly'] } }),
  p('you-com', 'You.com', 'You.com', 'research', 'You.com', { web: { planKeys: ['pro_monthly'] } }),

  // —— 设计 ——
  p('figma-ai', 'Figma AI', 'Figma AI', 'design', 'Figma', { web: { planKeys: ['professional_monthly'] } }),
  p('adobe-cc', 'Adobe Creative Cloud', 'Adobe Creative Cloud', 'design', 'Adobe', {
    web: { planKeys: ['all_apps_monthly'] },
  }),
  p('meitu-ai', 'Meitu AI', '美图秀秀 AI', 'design', '美图', {
    appstore: { trackId: 416048305, planHints: ['vip', 'pro', '美图'] },
    web: { planKeys: ['vip_monthly'] },
  }),
  p('wink', 'Wink', 'Wink', 'design', 'Wink', { web: { planKeys: ['pro_monthly'] } }),
  p('framer-ai', 'Framer AI', 'Framer AI', 'design', 'Framer', { web: { planKeys: ['pro_monthly'] } }),
  p('galileo-ai', 'Galileo AI', 'Galileo AI', 'design', 'Galileo', { web: { planKeys: ['pro_monthly'] } }),
  p('uizard', 'Uizard', 'Uizard', 'design', 'Uizard', { web: { planKeys: ['pro_monthly'] } }),
  p('looka', 'Looka', 'Looka', 'design', 'Looka', { web: { planKeys: ['basic'] } }),

  // —— 教育 ——
  p('duolingo-max', 'Duolingo Max', 'Duolingo Max', 'edu', 'Duolingo', {
    appstore: { trackId: 1094930513, planHints: ['max', 'super', 'duolingo'] },
    web: { planKeys: ['max_monthly'] },
  }),
  p('khanmigo', 'Khanmigo', 'Khanmigo', 'edu', 'Khan Academy', { web: { planKeys: ['monthly'] } }),
  p('photomath-plus', 'Photomath Plus', 'Photomath Plus', 'edu', 'Photomath', {
    appstore: { trackId: 919087726, planHints: ['plus', 'photomath'] },
    web: { planKeys: ['plus_monthly'] },
  }),
  p('gauth-ai', 'Gauth AI', 'Gauth AI', 'edu', 'Gauth', {
    appstore: { trackId: 1547530152, planHints: ['plus', 'pro', 'gauth'] },
    web: { planKeys: ['plus_monthly'] },
  }),
  p('question-ai', 'Question AI', 'Question AI', 'edu', 'Question AI', { web: { planKeys: ['pro_monthly'] } }),

  // —— 生活 / 健康 ——
  p('calm', 'Calm', 'Calm', 'health', 'Calm', {
    appstore: { trackId: 571800810, planHints: ['premium', 'calm'] },
    web: { planKeys: ['premium_monthly'] },
  }),
  p('headspace', 'Headspace', 'Headspace', 'health', 'Headspace', {
    appstore: { trackId: 493145008, planHints: ['plus', 'headspace'] },
    web: { planKeys: ['plus_monthly'] },
  }),
  p('noom', 'Noom', 'Noom', 'health', 'Noom', {
    appstore: { trackId: 634799440, planHints: ['premium', 'noom'] },
    web: { planKeys: ['monthly'] },
  }),
  p('myfitnesspal', 'MyFitnessPal Premium', 'MyFitnessPal Premium', 'health', 'MyFitnessPal', {
    appstore: { trackId: 341232718, planHints: ['premium', 'myfitnesspal'] },
    web: { planKeys: ['premium_monthly'] },
  }),

  // —— AI 硬件订阅 ——
  p('rabbit-r1', 'Rabbit R1', 'Rabbit R1', 'hardware', 'Rabbit', { web: { planKeys: ['monthly'] } }),
  p('humane-ai-pin', 'Humane AI Pin', 'Humane AI Pin', 'hardware', 'Humane', { web: { planKeys: ['monthly'] } }),
  p('friend-pendant', 'Friend', 'Friend（AI 挂件）', 'hardware', 'Friend', { web: { planKeys: ['monthly'] } }),
  p('meta-rayban-ai', 'Meta Ray-Ban AI', 'Meta Ray-Ban（AI 功能）', 'hardware', 'Meta', {
    web: { planKeys: ['meta_ai_plus'] },
  }),
]

export const PRODUCT_MAP = Object.fromEntries(AI_PRODUCTS.map((x) => [x.productId, x]))

export function hasFreeTier(productId) {
  const id = resolveProductId(productId)
  const product = getProduct(id)
  if (!product) return false
  return Boolean(product.hasFreeTier)
}

export function getProduct(productId) {
  const id = resolveProductId(productId)
  const base = PRODUCT_MAP[id]
  if (!base) return null
  const sheet = loadSheetOverlay()?.products?.[id] || null
  const official = getOfficial(id)
  const web = base.channels?.web || {}
  const merged = {
    ...base,
    ...(sheet
      ? {
          hasFreeTier: sheet.hasFreeTier,
          planStructure: sheet.planStructure || '',
          freeTrial: sheet.freeTrial || '',
          personalPlans: sheet.personalPlans || '',
          teamPlans: sheet.teamPlans || '',
          apiPlans: sheet.apiPlans || '',
          buyout: sheet.buyout || '',
          statusNote: sheet.statusNote || '',
          changeNote: sheet.changeNote || '',
          sheetUpdated: sheet.sheetUpdated || null,
        }
      : {}),
  }
  if (!official) return merged
  return {
    ...merged,
    channels: {
      ...merged.channels,
      web: {
        ...web,
        pricingUrl: web.pricingUrl || official.pricingUrl || null,
        planKeys:
          (official.planKeys && official.planKeys.length && official.planKeys) ||
          web.planKeys ||
          [],
        officialStatus: official.status,
      },
    },
  }
}

export function listCategories() {
  return CATEGORIES
}

/** Vendor / product homepage domains — used for favicon when no App Store artwork. */
const VENDOR_DOMAINS = {
  OpenAI: 'openai.com',
  Anthropic: 'anthropic.com',
  Google: 'gemini.google.com',
  xAI: 'x.ai',
  Perplexity: 'perplexity.ai',
  Microsoft: 'copilot.microsoft.com',
  Quora: 'poe.com',
  Inflection: 'pi.ai',
  'Character.AI': 'character.ai',
  Luka: 'replika.com',
  Mistral: 'mistral.ai',
  'Hugging Face': 'huggingface.co',
  智谱: 'chatglm.cn',
  百度: 'yiyan.baidu.com',
  阿里: 'tongyi.aliyun.com',
  字节: 'doubao.com',
  月之暗面: 'kimi.moonshot.cn',
  科大讯飞: 'xinghuo.xfyun.cn',
  腾讯: 'hunyuan.tencent.com',
  MiniMax: 'minimaxi.com',
  阶跃星辰: 'stepfun.com',
  Anysphere: 'cursor.com',
  GitHub: 'github.com',
  Codeium: 'windsurf.com',
  JetBrains: 'jetbrains.com',
  Tabnine: 'tabnine.com',
  Replit: 'replit.com',
  Amazon: 'aws.amazon.com',
  Sourcegraph: 'sourcegraph.com',
  Cognition: 'cognition.ai',
  Augment: 'augmentcode.com',
  Supermaven: 'supermaven.com',
  Vercel: 'v0.dev',
  StackBlitz: 'bolt.new',
  Lovable: 'lovable.dev',
  Midjourney: 'midjourney.com',
  Adobe: 'adobe.com',
  Leonardo: 'leonardo.ai',
  Ideogram: 'ideogram.ai',
  'Black Forest Labs': 'bfl.ai',
  Canva: 'canva.com',
  Krea: 'krea.ai',
  Magnific: 'magnific.ai',
  Topaz: 'topazlabs.com',
  Skylum: 'skylum.com',
  PhotoRoom: 'photoroom.com',
  Stability: 'clipdrop.co',
  Playground: 'playground.com',
  Recraft: 'recraft.ai',
  Runway: 'runwayml.com',
  Pika: 'pika.art',
  Luma: 'lumalabs.ai',
  HeyGen: 'heygen.com',
  快手: 'klingai.com',
  生数: 'vidu.com',
  Synthesia: 'synthesia.io',
  'D-ID': 'd-id.com',
  Colossyan: 'colossyan.com',
  InVideo: 'invideo.io',
  Captions: 'captions.ai',
  Descript: 'descript.com',
  Opus: 'opus.pro',
  VEED: 'veed.io',
  ByteDance: 'capcut.com',
  PixVerse: 'pixverse.ai',
  Suno: 'suno.com',
  Udio: 'udio.com',
  ElevenLabs: 'elevenlabs.io',
  AIVA: 'aiva.ai',
  Boomy: 'boomy.com',
  Soundraw: 'soundraw.io',
  Mubert: 'mubert.com',
  Murf: 'murf.ai',
  'Play.ht': 'play.ht',
  Speechify: 'speechify.com',
  Notion: 'notion.so',
  Grammarly: 'grammarly.com',
  Jasper: 'jasper.ai',
  'Copy.ai': 'copy.ai',
  Writesonic: 'writesonic.com',
  QuillBot: 'quillbot.com',
  DeepL: 'deepl.com',
  Gamma: 'gamma.app',
  Tome: 'tome.app',
  'Beautiful.ai': 'beautiful.ai',
  Taskade: 'taskade.com',
  Coda: 'coda.io',
  Otter: 'otter.ai',
  Fireflies: 'fireflies.ai',
  Krisp: 'krisp.ai',
  Elicit: 'elicit.com',
  Consensus: 'consensus.app',
  'You.com': 'you.com',
  Figma: 'figma.com',
  美图: 'meitu.com',
  Wink: 'wink.com',
  Framer: 'framer.com',
  Galileo: 'usegalileo.ai',
  Uizard: 'uizard.io',
  Looka: 'looka.com',
  Duolingo: 'duolingo.com',
  'Khan Academy': 'khanacademy.org',
  Photomath: 'photomath.com',
  Gauth: 'gauthmath.com',
  'Question AI': 'questionai.com',
  Calm: 'calm.com',
  Headspace: 'headspace.com',
  Noom: 'noom.com',
  MyFitnessPal: 'myfitnesspal.com',
  Rabbit: 'rabbit.tech',
  Humane: 'humane.com',
  Friend: 'friend.com',
  Meta: 'meta.ai',
}

const PRODUCT_DOMAINS = {
  chatgpt: 'openai.com',
  claude: 'claude.ai',
  cursor: 'cursor.com',
  'claude-code': 'claude.ai',
  'github-copilot': 'github.com',
  midjourney: 'midjourney.com',
  'gemini-advanced': 'gemini.google.com',
  'microsoft-copilot-pro': 'copilot.microsoft.com',
  kling: 'klingai.com',
  seedance: 'jimeng.jianying.com',
  sora: 'openai.com',
  'pi-premium': 'pi.ai',
  'mistral-le-chat': 'chat.mistral.ai',
  'zhipu-glm': 'chatglm.cn',
  'huggingface-pro': 'huggingface.co',
}

export function iconFromDomain(domain) {
  const d = String(domain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim()
  if (!d) return ''
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`
}

/**
 * Resolve display icon:
 * 1) explicit product.icon
 * 2) App Store artwork (via getAppIcon(trackId))
 * 3) website favicon from pricingUrl / vendor domain
 */
export function resolveProductIcon(product, getAppIcon) {
  if (!product) return ''
  if (product.icon) return product.icon
  const trackId = product.channels?.appstore?.trackId
  if (trackId && typeof getAppIcon === 'function') {
    const fromStore = getAppIcon(trackId)
    if (fromStore) return fromStore
  }
  // Reuse artwork from another catalog product sharing the same App Store app.
  if (trackId && typeof getAppIcon === 'function') {
    for (const other of AI_PRODUCTS) {
      if (other.productId === product.productId) continue
      if (other.channels?.appstore?.trackId === trackId && other.icon) return other.icon
    }
  }
  // Same-vendor sibling that already has App Store artwork cached.
  if (product.vendor && typeof getAppIcon === 'function') {
    for (const other of AI_PRODUCTS) {
      if (other.vendor !== product.vendor) continue
      const tid = other.channels?.appstore?.trackId
      if (!tid) continue
      const ic = getAppIcon(tid)
      if (ic) return ic
    }
  }
  const pricingUrl = product.channels?.web?.pricingUrl
  let domain =
    product.iconDomain ||
    PRODUCT_DOMAINS[product.productId] ||
    VENDOR_DOMAINS[product.vendor] ||
    ''
  if (!domain && pricingUrl) {
    try {
      domain = new URL(pricingUrl).hostname
    } catch {
      /* ignore */
    }
  }
  return iconFromDomain(domain)
}

/** Keep old seed shape for App Store scrape helpers. */
export const QUICK_COUNTRY_CODES = [
  'us', 'tr', 'ph', 'in', 'pk', 'ng', 'eg', 'br', 'mx', 'jp', 'kr', 'tw', 'hk',
  'sg', 'th', 'id', 'vn', 'ca', 'gb', 'de', 'au', 'cn',
]

export const HOT_TOP10 = HOT_PRODUCTS.slice(0, 10)
  .map((id) => {
    const prod = PRODUCT_MAP[id]
    const trackId = prod?.channels?.appstore?.trackId
    if (!trackId) return null
    return { trackId, category: prod.category, slug: id, productId: id }
  })
  .filter(Boolean)

export const SEED_APPS = [
  ...new Map(
    AI_PRODUCTS.filter((p) => p.channels?.appstore?.trackId).map((p) => [
      p.channels.appstore.trackId,
      {
        trackId: p.channels.appstore.trackId,
        category: p.category,
        slug: p.productId,
        productId: p.productId,
      },
    ]),
  ).values(),
]
