/**
 * Multi-tier official public plans to overlay onto official-web-prices.
 * Only confident list prices (no "?"). yearly_* = effective monthly when billed annually.
 * Daily sheet price patches: sheet/price-patches.json (from apply-sheet.mjs).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

/** @type {Record<string, { pricingUrl?: string, plans: Record<string, object> }>} */
export const PLAN_EXPANSIONS = {
  // —— chat ——
  'gemini-advanced': {
    pricingUrl: 'https://gemini.google/subscriptions',
    plans: {
      ai_plus_monthly: usd(4.99, 'Google AI Plus 公开标价'),
      advanced_monthly: usd(19.99, 'AI Pro 公开标价'),
      advanced_yearly: usd(16.67, 'AI Pro 年付折合月价（$199.99/年）'),
      spark_monthly: usd(99.99, 'AI Ultra 5x 公开标价'),
      ai_ultra_monthly: usd(199.99, 'AI Ultra 20x 公开标价'),
    },
  },
  'grok-premium': {
    pricingUrl: 'https://x.ai/grok',
    plans: {
      premium_monthly: usd(30, 'SuperGrok 公开标价'),
      premium_yearly: usd(25, 'SuperGrok 年付折合月价'),
      heavy_monthly: usd(300, 'SuperGrok Heavy 公开标价'),
    },
  },
  'perplexity-pro': {
    pricingUrl: 'https://www.perplexity.ai/pro',
    plans: {
      pro_monthly: usd(20, 'Pro 月付'),
      pro_yearly: usd(16.67, 'Pro 年付折合月价'),
      max_monthly: usd(200, 'Max 月付'),
      max_yearly: usd(166.67, 'Max 年付折合月价'),
    },
  },
  'microsoft-copilot-pro': {
    pricingUrl:
      'https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/individuals',
    plans: {
      m365_personal_monthly: usd(9.99, 'Microsoft 365 Personal 月付'),
      m365_personal_yearly: usd(8.33, 'Microsoft 365 Personal 年付折合月价'),
      m365_family_monthly: usd(12.99, 'Microsoft 365 Family 月付'),
      m365_family_yearly: usd(10.83, 'Microsoft 365 Family 年付折合月价'),
      m365_premium_monthly: usd(19.99, 'Microsoft 365 Premium 月付'),
      m365_premium_yearly: usd(16.67, 'Microsoft 365 Premium 年付折合月价'),
    },
  },
  'poe-premium': {
    pricingUrl: 'https://poe.com/premium',
    plans: {
      starter_monthly: usd(4.99, 'Starter 月付'),
      standard_monthly: usd(19.99, 'Standard 月付'),
      pro_monthly: usd(49.99, 'Pro 月付'),
      premium_monthly: usd(99.99, 'Premium / Power 月付'),
    },
  },
  'character-ai-plus': {
    pricingUrl: 'https://character.ai/subscribe',
    plans: {
      plus_monthly: usd(9.99, 'c.ai+ 月付'),
      plus_yearly: usd(7.92, 'c.ai+ 年付折合月价（$94.99/年）'),
    },
  },
  'replika-pro': {
    pricingUrl: 'https://replika.com/pro',
    plans: {
      pro_monthly: usd(19.99, 'Pro 月付'),
      pro_yearly: usd(5.83, 'Pro 年付折合月价'),
    },
  },
  'mistral-le-chat': {
    pricingUrl: 'https://mistral.ai/pricing',
    plans: {
      pro_monthly: usd(14.99, 'Le Chat Pro'),
      team_monthly: usd(24.99, 'Team 月付/席'),
    },
  },
  'huggingface-pro': {
    pricingUrl: 'https://huggingface.co/pricing',
    plans: {
      pro_monthly: usd(9, 'Pro 月付'),
      team_monthly: usd(20, 'Team 月付/席'),
      enterprise_monthly: usd(50, 'Enterprise 月付/席'),
    },
  },
  doubao: {
    pricingUrl: 'https://www.doubao.com',
    plans: {
      plus_monthly: cny(39.9, '豆包会员公开标价'),
      pro_standard_monthly: cny(68, 'Pro 标准档'),
      pro_enhanced_monthly: cny(200, 'Pro 增强档'),
      pro_advanced_monthly: cny(500, 'Pro 高阶档'),
    },
  },
  'zhipu-glm': {
    pricingUrl: 'https://chatglm.cn',
    plans: {
      plus_monthly: cny(49, '清言会员公开标价'),
      vip_auto_monthly: cny(19, '连续包月'),
      vip_month_card: cny(59, '月卡'),
      vip_year_card: cny(399, '年卡'),
    },
  },
  sparkdesk: {
    pricingUrl: 'https://xinghuo.xfyun.cn',
    plans: {
      // 星火 C 端常见公开档（青春/标准/Plus）；活动价以 App 内为准
      youth_monthly: cny(9.9, '青春版月付（学生等认证）'),
      youth_yearly: cny(7.42, '青春版年付折合月价（年付 ¥89）'),
      standard_monthly: cny(29.9, '标准版月付'),
      standard_yearly: cny(16.58, '标准版年付折合月价（年付 ¥199）'),
      plus_monthly: cny(99, 'Plus 月付'),
      plus_yearly: cny(74.92, 'Plus 年付折合月价（年付 ¥899）'),
      auto_monthly: cny(19, '连续包月/无忧档常见续费价'),
    },
  },
  'ernie-bot': {
    pricingUrl: 'https://yiyan.baidu.com',
    plans: {
      plus_monthly: cny(59.9, '文心会员月付'),
      plus_yearly: cny(24.9, '文心会员年付折合月价（常见年卡折合）'),
      auto_monthly: cny(49.9, '连续包月常见价'),
    },
  },
  qwen: {
    pricingUrl: 'https://tongyi.aliyun.com',
    plans: {
      plus_monthly: cny(39.9, '通义会员公开标价'),
      plus_yearly: cny(16.6, '会员年付折合月价（常见档）'),
    },
  },
  hunyuan: {
    pricingUrl: 'https://hunyuan.tencent.com',
    plans: {
      plus_monthly: cny(48, '混元会员月付'),
      plus_yearly: cny(20, '混元会员年付折合月价（常见档）'),
    },
  },
  'minimax-hailuo': {
    pricingUrl: 'https://www.minimaxi.com',
    plans: {
      plus_monthly: cny(49, '海螺/MiniMax 会员月付'),
      pro_monthly: cny(99, '更高用量档公开入口'),
    },
  },
  stepfun: {
    // Step Plan（开放平台公开价）：https://platform.stepfun.com/docs/zh/step-plan/overview
    // 年付/季付金额按账单总额÷周期，记为折合月价
    pricingUrl: 'https://platform.stepfun.com/docs/zh/step-plan/overview',
    plans: {
      flash_mini_monthly: cny(49, 'Flash Mini 月付'),
      flash_mini_quarterly: cny(43, 'Flash Mini 季付折合月价（¥129/季）'),
      flash_mini_yearly: cny(38, 'Flash Mini 年付折合月价（¥456/年）'),
      flash_plus_monthly: cny(99, 'Flash Plus 月付'),
      flash_plus_quarterly: cny(89.67, 'Flash Plus 季付折合月价（¥269/季）'),
      flash_plus_yearly: cny(78, 'Flash Plus 年付折合月价（¥936/年）'),
      flash_pro_monthly: cny(199, 'Flash Pro 月付'),
      flash_pro_quarterly: cny(179.67, 'Flash Pro 季付折合月价（¥539/季）'),
      flash_pro_yearly: cny(155, 'Flash Pro 年付折合月价（¥1860/年）'),
      flash_max_monthly: cny(699, 'Flash Max 月付'),
      flash_max_quarterly: cny(629.67, 'Flash Max 季付折合月价（¥1889/季）'),
      flash_max_yearly: cny(555.5, 'Flash Max 年付折合月价（¥6666/年）'),
    },
  },
  'hailuo-video': {
    pricingUrl: 'https://hailuoai.video',
    plans: {
      plus_monthly: cny(69, '基础会员'),
      standard_monthly: cny(199, '标准会员'),
      advanced_monthly: cny(499, '高阶会员'),
    },
  },
  qingying: {
    pricingUrl: 'https://chatglm.cn/video',
    plans: {
      plus_monthly: cny(49, '清影会员月付'),
      plus_yearly: cny(25, '清影会员年付折合月价（常见档）'),
    },
  },
  'meitu-ai': {
    pricingUrl: 'https://xiuxiu.meitu.com',
    plans: {
      vip_monthly: cny(25, 'VIP 月付'),
      vip_yearly: cny(8.25, 'VIP 年付折合月价（年付常见 ¥99）'),
    },
  },

  // —— coding ——
  'windsurf-pro': {
    pricingUrl: 'https://devin.ai/pricing',
    plans: {
      pro_monthly: usd(20, 'Pro 月付'),
      max_monthly: usd(200, 'Max 月付'),
      teams_base_monthly: usd(80, 'Teams 团队底价月付'),
      teams_monthly: usd(40, 'Teams 全量席位月付'),
    },
  },
  'jetbrains-ai-pro': {
    pricingUrl: 'https://www.jetbrains.com/ai/',
    plans: {
      pro_monthly: usd(10, 'AI Pro 个人月付'),
      pro_yearly: usd(8.33, 'AI Pro 年付折合月价'),
      ultimate_monthly: usd(30, 'AI Ultimate 个人月付'),
      ultimate_yearly: usd(25, 'AI Ultimate 年付折合月价'),
    },
  },
  'tabnine-pro': {
    pricingUrl: 'https://www.tabnine.com/pricing',
    plans: {
      code_assistant_yearly: usd(39, 'Code Assistant 年付折合月价/席'),
      agentic_yearly: usd(59, 'Agentic Platform 年付折合月价/席'),
    },
  },
  'replit-core': {
    pricingUrl: 'https://replit.com/pricing',
    plans: {
      core_monthly: usd(20, 'Core 月付'),
      core_yearly: usd(18, 'Core 年付折合月价'),
      pro_monthly: usd(100, 'Pro 月付'),
      pro_yearly: usd(90, 'Pro 年付折合月价'),
    },
  },
  'sourcegraph-cody': {
    pricingUrl: 'https://sourcegraph.com/pricing',
    plans: {
      pro_monthly: usd(9, 'Cody Pro 月付'),
    },
  },
  v0: {
    pricingUrl: 'https://v0.app/pricing',
    plans: {
      plus_monthly: usd(30, 'Plus 月付/席'),
      business_monthly: usd(100, 'Business 月付/席'),
    },
  },
  'bolt-new': {
    pricingUrl: 'https://bolt.new/pricing',
    plans: {
      pro_monthly: usd(25, 'Pro 月付'),
      teams_monthly: usd(30, 'Teams 月付'),
    },
  },
  lovable: {
    pricingUrl: 'https://lovable.dev/pricing',
    plans: {
      pro_monthly: usd(25, 'Pro 月付'),
      pro_yearly: usd(21, 'Pro 年付折合月价'),
      business_monthly: usd(50, 'Business 入门月付'),
    },
  },

  // —— image ——
  'adobe-firefly': {
    pricingUrl: 'https://www.adobe.com/products/firefly.html',
    plans: {
      standard_monthly: usd(9.99, 'Firefly Standard'),
      pro_monthly: usd(19.99, 'Firefly Pro'),
      premium_monthly: usd(199.99, 'Firefly Premium'),
    },
  },
  'leonardo-ai': {
    pricingUrl: 'https://leonardo.ai/pricing',
    plans: {
      apprentice_monthly: usd(12, 'Apprentice'),
      artisan_monthly: usd(30, 'Artisan'),
      maestro_monthly: usd(60, 'Maestro'),
    },
  },
  ideogram: {
    pricingUrl: 'https://ideogram.ai/pricing',
    plans: {
      plus_monthly: usd(20, 'Plus 月付'),
      plus_yearly: usd(15, 'Plus 年付折合月价（$180/年）'),
      pro_monthly: usd(60, 'Pro 月付'),
      pro_yearly: usd(42, 'Pro 年付折合月价（$504/年）'),
      team_monthly: usd(30, 'Team 月付/席'),
      team_yearly: usd(20, 'Team 年付折合月价/席'),
    },
  },
  'canva-pro': {
    pricingUrl: 'https://www.canva.com/pricing/',
    plans: {
      pro_monthly: usd(14.99, 'Pro 月付'),
      pro_yearly: usd(12.99, 'Pro 年付折合月价'),
      business_monthly: usd(29.99, 'Business 月付/席'),
      business_yearly: usd(24.99, 'Business 年付折合月价'),
    },
  },
  'krea-ai': {
    pricingUrl: 'https://www.krea.ai/pricing',
    plans: {
      basic_monthly: usd(9, 'Basic 月付'),
      pro_monthly: usd(35, 'Pro 月付'),
      max_monthly: usd(105, 'Max 月付（默认 60k units）'),
      business_monthly: usd(200, 'Business 月付'),
      basic_yearly: usd(5.25, 'Basic 年付折合月价'),
      pro_yearly: usd(21, 'Pro 年付折合月价'),
      max_yearly: usd(63, 'Max 年付折合月价（默认 60k）'),
      business_yearly: usd(160, 'Business 年付折合月价'),
    },
  },
  photoroom: {
    pricingUrl: 'https://www.photoroom.com/pricing',
    plans: {
      pro_monthly: usd(12.99, 'Pro 月付'),
      pro_yearly: usd(7.5, 'Pro 年付折合月价'),
      max_monthly: usd(34.99, 'Max 月付'),
      max_yearly: usd(20.99, 'Max 年付折合月价'),
    },
  },
  midjourney: {
    pricingUrl: 'https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans',
    plans: {
      basic_monthly: usd(10, 'Basic 月付'),
      basic_yearly: usd(8, 'Basic 年付折合月价'),
      standard_monthly: usd(30, 'Standard 月付'),
      standard_yearly: usd(24, 'Standard 年付折合月价'),
      pro_monthly: usd(60, 'Pro 月付'),
      pro_yearly: usd(48, 'Pro 年付折合月价'),
      mega_monthly: usd(120, 'Mega 月付'),
      mega_yearly: usd(96, 'Mega 年付折合月价'),
    },
  },

  // —— video ——
  runway: {
    pricingUrl: 'https://runwayml.com/pricing',
    plans: {
      standard_monthly: usd(15, 'Standard 月付'),
      standard_yearly: usd(12, 'Standard 年付折合月价'),
      pro_monthly: usd(35, 'Pro 月付'),
      pro_yearly: usd(28, 'Pro 年付折合月价'),
      max_monthly: usd(95, 'Max 月付'),
      max_yearly: usd(76, 'Max 年付折合月价'),
      team_monthly: usd(69, 'Team 月付/席'),
    },
  },
  pika: {
    pricingUrl: 'https://pika.art/pricing',
    plans: {
      standard_monthly: usd(10, 'Standard 月付'),
      standard_yearly: usd(8, 'Standard 年付折合月价'),
      pro_monthly: usd(35, 'Pro 月付'),
      pro_yearly: usd(28, 'Pro 年付折合月价'),
      fancy_monthly: usd(95, 'Fancy 月付'),
      fancy_yearly: usd(76, 'Fancy 年付折合月价'),
    },
  },
  'luma-dream-machine': {
    pricingUrl: 'https://lumalabs.ai/pricing',
    plans: {
      plus_monthly: usd(30, 'Plus 月付'),
      plus_yearly: usd(25, 'Plus 年付折合月价'),
      pro_monthly: usd(90, 'Pro 月付'),
      pro_yearly: usd(75, 'Pro 年付折合月价'),
      ultra_monthly: usd(300, 'Ultra 月付'),
      ultra_yearly: usd(250, 'Ultra 年付折合月价'),
    },
  },
  heygen: {
    pricingUrl: 'https://www.heygen.com/pricing',
    plans: {
      creator_monthly: usd(29, 'Creator 月付'),
      creator_yearly: usd(24, 'Creator 年付折合月价（$288/年）'),
      pro_monthly: usd(49, 'Pro 月付（入门 1000 credits）'),
      pro_yearly: usd(41, 'Pro 年付折合月价（入门；$488/年）'),
      business_monthly: usd(149, 'Business 月付（另+$20/席）'),
      business_yearly: usd(119, 'Business 年付折合月价（$1,428/年；另+$20/席）'),
    },
  },
  kling: {
    pricingUrl: 'https://klingai.com/pricing',
    plans: {
      standard_monthly: cny(66, '标准会员'),
      pro_monthly: cny(266, '专业会员'),
      premier_monthly: cny(666, '旗舰会员'),
    },
  },
  seedance: {
    pricingUrl: 'https://jimeng.jianying.com',
    plans: {
      plus_monthly: cny(75, '即梦基础会员'),
      standard_monthly: cny(199, '标准会员'),
      advanced_monthly: cny(499, '高阶会员'),
    },
  },
  vidu: {
    pricingUrl: 'https://www.vidu.com/pricing',
    plans: {
      plus_monthly: cny(69, '国内公开标价'),
      standard_monthly: usd(10, 'Standard'),
      premium_monthly: usd(35, 'Premium'),
      ultimate_monthly: usd(99, 'Ultimate'),
    },
  },
  synthesia: {
    pricingUrl: 'https://www.synthesia.io/pricing',
    plans: {
      starter_monthly: usd(29, 'Starter 月付'),
      starter_yearly: usd(18, 'Starter 年付折合月价'),
      creator_monthly: usd(89, 'Creator 月付'),
      creator_yearly: usd(64, 'Creator 年付折合月价'),
    },
  },
  'd-id': {
    pricingUrl: 'https://www.d-id.com/pricing',
    plans: {
      lite_monthly: usd(5.99, 'Lite'),
      pro_monthly: usd(29, 'Pro'),
      advanced_monthly: usd(196, 'Advanced'),
    },
  },
  descript: {
    pricingUrl: 'https://www.descript.com/pricing',
    plans: {
      hobbyist_monthly: usd(24, 'Hobbyist 月付'),
      hobbyist_yearly: usd(16, 'Hobbyist 年付折合月价'),
      creator_monthly: usd(35, 'Creator 月付'),
      creator_yearly: usd(24, 'Creator 年付折合月价'),
      business_monthly: usd(65, 'Business 月付'),
      business_yearly: usd(50, 'Business 年付折合月价'),
    },
  },
  'opus-clip': {
    pricingUrl: 'https://www.opus.pro/pricing',
    plans: {
      starter_monthly: usd(15, 'Starter'),
      pro_monthly: usd(29, 'Pro 月付'),
      pro_yearly: usd(14.5, 'Pro 年付折合月价'),
    },
  },
  'veed-io': {
    pricingUrl: 'https://www.veed.io/pricing',
    plans: {
      creator_monthly: usd(18, 'Creator'),
      pro_monthly: usd(24, 'Pro'),
      business_monthly: usd(59, 'Business'),
    },
  },
  'capcut-pro': {
    pricingUrl: 'https://www.capcut.com/pricing',
    plans: {
      pro_monthly: {
        ...usd(7.99, 'Pro 国际站月付'),
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
      standard_monthly: usd(9.99, 'Standard'),
      team_monthly: usd(24.99, 'Team'),
    },
  },
  colossyan: {
    pricingUrl: 'https://www.colossyan.com/pricing',
    plans: {
      starter_monthly: usd(27, 'Starter'),
      business_monthly: usd(76, 'Business'),
    },
  },
  'invideo-ai': {
    pricingUrl: 'https://invideo.io/pricing/',
    plans: {
      plus_monthly: usd(25, 'Plus'),
      max_monthly: usd(60, 'Max'),
    },
  },

  // —— audio ——
  suno: {
    pricingUrl: 'https://suno.com/pricing',
    plans: {
      pro_monthly: usd(10, 'Pro 月付'),
      pro_yearly: usd(8, 'Pro 年付折合月价'),
      premier_monthly: usd(30, 'Premier 月付'),
      premier_yearly: usd(24, 'Premier 年付折合月价'),
    },
  },
  udio: {
    pricingUrl: 'https://www.udio.com/pricing',
    plans: {
      standard_monthly: usd(10, 'Standard 月付'),
      standard_yearly: usd(8, 'Standard 年付折合月价'),
      pro_monthly: usd(30, 'Pro 月付'),
      pro_yearly: usd(24, 'Pro 年付折合月价'),
    },
  },
  elevenlabs: {
    pricingUrl: 'https://elevenlabs.io/pricing',
    plans: {
      starter_monthly: usd(6, 'Starter 月付'),
      starter_yearly: usd(5, 'Starter 年付折合月价'),
      creator_monthly: usd(22, 'Creator 月付'),
      creator_yearly: usd(18.33, 'Creator 年付折合月价'),
      pro_monthly: usd(99, 'Pro 月付'),
      pro_yearly: usd(82.5, 'Pro 年付折合月价'),
      scale_monthly: usd(299, 'Scale 月付'),
      scale_yearly: usd(249.17, 'Scale 年付折合月价'),
      business_monthly: usd(990, 'Business 月付'),
      business_yearly: usd(825, 'Business 年付折合月价'),
    },
  },
  // —— writing ——
  'grammarly-premium': {
    pricingUrl: 'https://www.grammarly.com/plans',
    plans: {
      premium_monthly: usd(30, 'Pro 月付'),
      premium_yearly: usd(12, 'Pro 年付折合月价（$144/年）'),
    },
  },
  jasper: {
    pricingUrl: 'https://www.jasper.ai/pricing',
    plans: {
      pro_monthly: usd(69, 'Pro 月付/席'),
      pro_yearly: usd(59, 'Pro 年付折合月价/席'),
    },
  },
  'copy-ai': {
    pricingUrl: 'https://www.copy.ai/pricing',
    plans: {
      chat_monthly: usd(29, 'Chat'),
      agents_monthly: usd(249, 'Agents 入门公开档'),
    },
  },
  writesonic: {
    pricingUrl: 'https://writesonic.com/pricing',
    plans: {
      lite_monthly: usd(49, 'Lite'),
      standard_monthly: usd(99, 'Standard'),
      professional_monthly: usd(249, 'Professional'),
    },
  },
  'deepl-pro': {
    pricingUrl: 'https://www.deepl.com/pro',
    plans: {
      starter_monthly: usd(8.74, 'Individual / Starter 年付折合'),
      individual_monthly: eur(10.49, 'Individual 月付'),
      team_monthly: eur(34.49, 'Team 月付'),
      business_monthly: eur(68.99, 'Business 月付'),
    },
  },
  gamma: {
    pricingUrl: 'https://gamma.app/pricing',
    plans: {
      plus_monthly: usd(10, 'Plus'),
      pro_monthly: usd(20, 'Pro'),
      ultra_monthly: usd(40, 'Ultra / 更高档公开入口'),
    },
  },
  'otter-ai': {
    pricingUrl: 'https://otter.ai/pricing',
    plans: {
      pro_monthly: usd(16.99, 'Pro 月付'),
      pro_yearly: usd(8.33, 'Pro 年付折合月价'),
      business_monthly: usd(30, 'Business 月付'),
      business_yearly: usd(19.99, 'Business 年付折合月价'),
    },
  },
  'fireflies-ai': {
    pricingUrl: 'https://fireflies.ai/pricing',
    plans: {
      pro_monthly: usd(18, 'Pro 月付'),
      pro_yearly: usd(10, 'Pro 年付折合月价'),
      business_monthly: usd(29, 'Business 月付'),
      business_yearly: usd(19, 'Business 年付折合月价'),
    },
  },
  quillbot: {
    pricingUrl: 'https://quillbot.com/premium',
    plans: {
      premium_monthly: usd(9.95, 'Premium 月付'),
      premium_yearly: usd(4.17, 'Premium 年付折合月价'),
    },
  },

  // —— design ——
  'figma-ai': {
    pricingUrl: 'https://www.figma.com/pricing/',
    plans: {
      professional_monthly: usd(16, 'Professional 全功能席位'),
      organization_monthly: usd(55, 'Organization 全功能席位'),
    },
  },
  'adobe-cc': {
    pricingUrl: 'https://www.adobe.com/creativecloud/plans.html',
    plans: {
      photography_monthly: usd(19.99, 'Photography 1TB'),
      all_apps_monthly: usd(59.99, 'All Apps / Creative Cloud'),
      all_apps_pro_monthly: usd(69.99, 'Creative Cloud Pro'),
    },
  },
  'framer-ai': {
    pricingUrl: 'https://www.framer.com/pricing/',
    plans: {
      basic_monthly: usd(10, 'Basic'),
      pro_monthly: usd(30, 'Pro'),
      scale_monthly: usd(100, 'Scale'),
    },
  },
  uizard: {
    pricingUrl: 'https://uizard.io/pricing/',
    plans: {
      pro_monthly: usd(19, 'Pro 月付'),
      pro_yearly: usd(12, 'Pro 年付折合月价'),
      business_monthly: usd(39, 'Business'),
    },
  },

  // —— edu / health ——
  'duolingo-max': {
    pricingUrl: 'https://www.duolingo.com/super',
    plans: {
      super_monthly: usd(13.99, 'Super 月付'),
      super_yearly: usd(6.99, 'Super 年付折合月价'),
      max_monthly: usd(29.99, 'Max 月付'),
      max_yearly: usd(14.99, 'Max 年付折合月价'),
    },
  },
  calm: {
    pricingUrl: 'https://www.calm.com/pricing',
    plans: {
      premium_monthly: usd(14.99, 'Premium 月付'),
      premium_yearly: usd(5.83, 'Premium 年付折合月价'),
    },
  },
  headspace: {
    pricingUrl: 'https://www.headspace.com/subscriptions',
    plans: {
      plus_monthly: usd(12.99, 'Individual 月付'),
      plus_yearly: usd(5.83, 'Individual 年付折合月价'),
    },
  },
  myfitnesspal: {
    pricingUrl: 'https://www.myfitnesspal.com/premium',
    plans: {
      premium_monthly: usd(19.99, 'Premium 月付'),
      premium_yearly: usd(6.67, 'Premium 年付折合月价'),
    },
  },

  // —— remaining singles: expand known multi-tier or monthly+yearly ——
  'microsoft-copilot-pro': {
    pricingUrl: 'https://www.microsoft.com/microsoft-365/copilot/pricing',
    plans: {
      pro_monthly: usd(20, 'Copilot Pro 个人月付'),
      m365_personal_monthly: usd(9.99, 'Microsoft 365 Personal（含部分 AI）'),
      m365_family_monthly: usd(12.99, 'Microsoft 365 Family'),
    },
  },
  'claude-code': {
    pricingUrl: 'https://www.anthropic.com/claude-code',
    plans: {
      code_monthly: usd(20, '随 Claude Pro'),
      max_monthly: usd(100, '随 Claude Max'),
    },
  },
  'amazon-q': {
    pricingUrl: 'https://aws.amazon.com/q/developer/pricing/',
    plans: {
      pro_monthly: usd(19, 'Q Developer Pro'),
    },
  },
  devin: {
    pricingUrl: 'https://devin.ai/pricing',
    plans: {
      pro_monthly: usd(20, 'Pro 月付'),
      max_monthly: usd(200, 'Max 月付'),
      teams_base_monthly: usd(80, 'Teams 团队底价月付'),
      teams_seat_monthly: usd(40, 'Teams 全量席位月付'),
    },
  },
  'sourcegraph-cody': {
    pricingUrl: 'https://sourcegraph.com/pricing',
    plans: {
      pro_monthly: usd(9, 'Cody Pro'),
      enterprise_monthly: usd(49, 'Enterprise 公开入门参考'),
    },
  },
  supermaven: {
    pricingUrl: 'https://supermaven.com/pricing',
    plans: {
      pro_monthly: usd(10, 'Pro 月付'),
      pro_yearly: usd(8, 'Pro 年付折合月价'),
    },
  },
  'augment-code': {
    pricingUrl: 'https://www.augmentcode.com/pricing',
    plans: {
      pro_monthly: usd(50, 'Developer / Pro 入门'),
      max_monthly: usd(100, '更高档公开入口'),
    },
  },
  'flux-pro': {
    pricingUrl: 'https://bfl.ai/pricing',
    plans: {
      pro_monthly: usd(12, '入门档参考'),
      max_monthly: usd(60, '更高用量档'),
      ultra_monthly: usd(120, '重度档'),
    },
  },
  'magnific-ai': {
    pricingUrl: 'https://magnific.ai/pricing',
    plans: {
      pro_monthly: usd(39, 'Pro'),
      business_monthly: usd(99, 'Business'),
    },
  },
  'topaz-photo-ai': {
    pricingUrl: 'https://www.topazlabs.com/topaz-photo-ai',
    plans: {
      monthly: usd(16.66, '订阅折合月价'),
      yearly: usd(199, '年付一次性（非月价）'),
    },
  },
  'luminar-neo': {
    pricingUrl: 'https://skylum.com/luminar',
    plans: {
      pro_monthly: usd(14.95, '订阅月付'),
      pro_yearly: usd(9.95, '年付折合月价'),
    },
  },
  clipdrop: {
    pricingUrl: 'https://clipdrop.co/pricing',
    plans: {
      pro_monthly: usd(9, 'Pro 月付'),
      pro_yearly: usd(7, 'Pro 年付折合月价'),
    },
  },
  'playground-ai': {
    pricingUrl: 'https://playground.com/pricing',
    plans: {
      pro_monthly: usd(15, 'Pro'),
      turbo_monthly: usd(45, 'Turbo'),
    },
  },
  'recraft-ai': {
    pricingUrl: 'https://www.recraft.ai/pricing',
    plans: {
      pro_monthly: usd(25, 'Pro'),
      team_monthly: usd(50, 'Team / Business 入门'),
    },
  },
  sora: {
    pricingUrl: 'https://openai.com/sora',
    plans: {
      plus_monthly: usd(20, '随 ChatGPT Plus'),
      pro_monthly: usd(200, '随 ChatGPT Pro'),
    },
  },
  captions: {
    pricingUrl: 'https://www.captions.ai/pricing',
    plans: {
      pro_monthly: usd(9.99, 'Pro 月付'),
      pro_yearly: usd(7.99, 'Pro 年付折合月价'),
      max_monthly: usd(29.99, 'Max'),
    },
  },
  pixverse: {
    pricingUrl: 'https://pixverse.ai/pricing',
    plans: {
      standard_monthly: usd(10, '标准版'),
      standard_yearly: usd(8, '标准版 年付折合月价'),
      pro_monthly: usd(30, '专业版'),
      pro_yearly: usd(24, '专业版 年付折合月价'),
      premium_monthly: usd(60, '尊享版'),
      premium_yearly: usd(48, '尊享版 年付折合月价'),
      ultimate_monthly: usd(199, '至尊版'),
      ultimate_yearly: usd(149, '至尊版 年付折合月价'),
      team_ultimate_monthly: usd(99, '团队至尊版'),
      team_ultimate_yearly: usd(79, '团队至尊版 年付折合月价'),
    },
  },
  'hailuo-video': {
    pricingUrl: 'https://hailuoai.video',
    plans: {
      plus_monthly: cny(69, '基础会员'),
      standard_monthly: cny(199, '标准会员'),
      pro_monthly: cny(399, '专业会员'),
    },
  },
  qingying: {
    pricingUrl: 'https://chatglm.cn/video',
    plans: {
      plus_monthly: cny(49, '清影会员'),
      pro_monthly: cny(99, '高阶档'),
      max_monthly: cny(199, '旗舰档'),
    },
  },
  aiva: {
    pricingUrl: 'https://www.aiva.ai/pricing',
    plans: {
      standard_monthly: eur(15, 'Standard'),
      pro_monthly: eur(49, 'Pro'),
    },
  },
  boomy: {
    pricingUrl: 'https://boomy.com/pricing',
    plans: {
      creator_monthly: usd(9.99, 'Creator'),
      pro_monthly: usd(29.99, 'Pro'),
    },
  },
  soundraw: {
    pricingUrl: 'https://soundraw.io/pricing',
    plans: {
      creator_monthly: usd(16.99, 'Creator'),
      artist_monthly: usd(29.99, 'Artist'),
    },
  },
  mubert: {
    pricingUrl: 'https://mubert.com/render/pricing',
    plans: {
      creator_monthly: usd(14, 'Creator'),
      pro_monthly: usd(39, 'Pro'),
    },
  },
  'murf-ai': {
    pricingUrl: 'https://murf.ai/pricing',
    plans: {
      creator_monthly: usd(29, 'Creator'),
      business_monthly: usd(99, 'Business'),
      enterprise_monthly: usd(149, 'Enterprise 入门'),
    },
  },
  'play-ht': {
    pricingUrl: 'https://play.ht/pricing/',
    plans: {
      creator_monthly: usd(39, 'Creator'),
      unlimited_monthly: usd(99, 'Unlimited'),
    },
  },
  speechify: {
    pricingUrl: 'https://speechify.com/pricing/',
    plans: {
      premium_monthly: usd(11.99, 'Premium 月付'),
      premium_yearly: usd(11.58, 'Premium 年付折合月价'),
    },
  },
  'notion-ai': {
    pricingUrl: 'https://www.notion.com/pricing',
    plans: {
      plus_monthly: usd(12, 'Plus 月付/席'),
      plus_yearly: usd(10, 'Plus 年付折合月价/席'),
      business_monthly: usd(24, 'Business 月付/席'),
      business_yearly: usd(20, 'Business 年付折合月价/席'),
    },
  },
  tome: {
    pricingUrl: 'https://tome.app/pricing',
    plans: {
      pro_monthly: usd(20, 'Pro'),
      business_monthly: usd(40, 'Business'),
    },
  },
  'beautiful-ai': {
    pricingUrl: 'https://www.beautiful.ai/pricing',
    plans: {
      pro_monthly: usd(12, 'Pro'),
      team_monthly: usd(40, 'Team'),
    },
  },
  'taskade-ai': {
    pricingUrl: 'https://www.taskade.com/pricing',
    plans: {
      pro_monthly: usd(10, 'Pro'),
      business_monthly: usd(20, 'Business'),
    },
  },
  'coda-ai': {
    pricingUrl: 'https://coda.io/pricing',
    plans: {
      pro_monthly: usd(10, 'Pro'),
      team_monthly: usd(30, 'Team'),
    },
  },
  krisp: {
    pricingUrl: 'https://krisp.ai/pricing/',
    plans: {
      pro_monthly: usd(8, 'Pro 月付'),
      pro_yearly: usd(5.5, 'Pro 年付折合月价'),
      business_monthly: usd(15, 'Business'),
    },
  },
  elicit: {
    pricingUrl: 'https://elicit.com/pricing',
    plans: {
      plus_monthly: usd(10, 'Plus'),
      pro_monthly: usd(49, 'Pro'),
      team_monthly: usd(79, 'Team'),
    },
  },
  consensus: {
    pricingUrl: 'https://consensus.app/home/pricing/',
    plans: {
      premium_monthly: usd(11.99, 'Premium 月付'),
      premium_yearly: usd(8.99, 'Premium 年付折合月价'),
      deep_monthly: usd(45, 'Deep / 更高档'),
    },
  },
  'you-com': {
    pricingUrl: 'https://you.com/pricing',
    plans: {
      pro_monthly: usd(20, 'Pro'),
      team_monthly: usd(30, 'Team'),
    },
  },
  'meitu-ai': {
    pricingUrl: 'https://xiuxiu.meitu.com',
    plans: {
      vip_monthly: cny(25, 'VIP 月付'),
      vip_yearly: cny(12, 'VIP 年付折合月价'),
      svip_monthly: cny(40, 'SVIP 月付'),
    },
  },
  wink: {
    pricingUrl: 'https://wink.com',
    plans: {
      pro_monthly: usd(7.99, 'Pro 月付'),
      pro_yearly: usd(4.99, 'Pro 年付折合月价'),
    },
  },
  'galileo-ai': {
    pricingUrl: 'https://www.usegalileo.ai/pricing',
    plans: {
      pro_monthly: usd(36, 'Pro / Stitch'),
      business_monthly: usd(72, 'Business'),
    },
  },
  looka: {
    pricingUrl: 'https://looka.com/pricing/',
    plans: {
      basic: usd(20, 'Basic 入口价'),
      premium: usd(96, 'Premium 年付入口'),
    },
  },
  khanmigo: {
    pricingUrl: 'https://www.khanmigo.ai/',
    plans: {
      monthly: usd(4, '个人月付'),
      yearly: usd(3.67, '年付折合月价'),
    },
  },
  'photomath-plus': {
    pricingUrl: 'https://photomath.com/plus',
    plans: {
      plus_monthly: usd(9.99, 'Plus 月付'),
      plus_yearly: usd(5.83, 'Plus 年付折合月价'),
    },
  },
  'gauth-ai': {
    pricingUrl: 'https://www.gauthmath.com',
    plans: {
      plus_monthly: usd(11.99, 'Plus 月付'),
      plus_yearly: usd(6.99, 'Plus 年付折合月价'),
    },
  },
  'question-ai': {
    pricingUrl: 'https://www.questionai.com',
    plans: {
      pro_monthly: usd(9.99, 'Pro 月付'),
      pro_yearly: usd(4.99, 'Pro 年付折合月价'),
    },
  },
  noom: {
    pricingUrl: 'https://www.noom.com',
    plans: {
      monthly: usd(70, '月付入门参考'),
      auto_monthly: usd(17, '较长合约折合月价常见入口'),
    },
  },
  'meta-rayban-ai': {
    pricingUrl: 'https://www.meta.com/ai/premium/',
    plans: {
      meta_ai_plus: usd(7.99, 'Meta AI+ 月付'),
      meta_ai_plus_yearly: usd(6.67, 'Meta AI+ 年付折合月价'),
    },
  },
}

function loadSheetPricePatches() {
  try {
    const p = path.join(__dirname, 'sheet', 'price-patches.json')
    if (!fs.existsSync(p)) return {}
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

function planFromPatch(entry) {
  const amount = Number(entry.amount)
  const currency = entry.currency || 'USD'
  const label = entry.label || ''
  if (currency === 'CNY') return cny(amount, label)
  if (currency === 'EUR') return eur(amount, label)
  return usd(amount, label)
}

/** Apply expansions onto official bundle, then daily sheet price patches. */
export function applyPlanExpansions(official) {
  const out = { ...official }
  for (const [id, exp] of Object.entries(PLAN_EXPANSIONS)) {
    if (!exp || !exp.plans) continue
    const prev = out[id] || {}
    out[id] = {
      pricingUrl: exp.pricingUrl || prev.pricingUrl || null,
      plans: { ...exp.plans },
      planKeys: Object.keys(exp.plans),
      status: 'priced',
      note: prev.note,
    }
  }

  const patches = loadSheetPricePatches()
  for (const [id, patch] of Object.entries(patches)) {
    const prev = out[id] || {}
    if (patch.status === 'missing' || !patch.plans || !Object.keys(patch.plans).length) {
      out[id] = {
        pricingUrl: patch.pricingUrl ?? prev.pricingUrl ?? null,
        plans: null,
        planKeys: [],
        status: 'missing',
        note: patch.note || prev.note || 'sheet:missing',
      }
      continue
    }
    const plans = {}
    for (const [planId, entry] of Object.entries(patch.plans)) {
      plans[planId] = planFromPatch(entry)
    }
    out[id] = {
      pricingUrl: patch.pricingUrl || prev.pricingUrl || null,
      plans,
      planKeys: Object.keys(plans),
      status: 'priced',
      note: patch.note || prev.note,
    }
  }
  return out
}
