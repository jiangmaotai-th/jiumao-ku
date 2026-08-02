/**
 * Spreadsheet display name → catalog productId.
 * Keep aliases here when sheet wording differs from catalog.nameZh.
 */
export const SHEET_NAME_TO_ID = {
  ChatGPT: 'chatgpt',
  Claude: 'claude',
  'Gemini Advanced': 'gemini-advanced',
  'Grok Premium': 'grok-premium',
  'Perplexity Pro': 'perplexity-pro',
  'Copilot Pro': 'microsoft-copilot-pro',
  'Poe Premium': 'poe-premium',
  'Pi Premium': 'pi-premium',
  'Character.AI Plus': 'character-ai-plus',
  'Replika Pro': 'replika-pro',
  'Mistral（Le Chat）': 'mistral-le-chat',
  'Hugging Face Pro': 'huggingface-pro',
  '智谱清言 GLM': 'zhipu-glm',
  智谱清言: 'zhipu-glm',
  文心一言: 'ernie-bot',
  通义千问: 'qwen',
  豆包: 'doubao',
  Kimi: 'kimi',
  讯飞星火: 'sparkdesk',
  '腾讯混元 / 元宝': 'hunyuan',
  腾讯混元: 'hunyuan',
  '海螺 AI（MiniMax）': 'minimax-hailuo',
  '跃问（阶跃星辰）': 'stepfun',
  Cursor: 'cursor',
  'GitHub Copilot': 'github-copilot',
  'Windsurf Pro': 'windsurf-pro',
  'Claude Code': 'claude-code',
  'JetBrains AI Pro': 'jetbrains-ai-pro',
  'Tabnine Pro': 'tabnine-pro',
  'Replit Core': 'replit-core',
  'Amazon Q Developer': 'amazon-q',
  'Sourcegraph Cody': 'sourcegraph-cody',
  Devin: 'devin',
  'Augment Code': 'augment-code',
  Supermaven: 'supermaven',
  'v0（Vercel）': 'v0',
  'Bolt.new': 'bolt-new',
  Lovable: 'lovable',
  Midjourney: 'midjourney',
  'Adobe Firefly': 'adobe-firefly',
  'Leonardo AI': 'leonardo-ai',
  Ideogram: 'ideogram',
  'FLUX Pro': 'flux-pro',
  'Canva Pro': 'canva-pro',
  'Krea AI': 'krea-ai',
  'Magnific AI': 'magnific-ai',
  'Topaz Photo AI': 'topaz-photo-ai',
  'Luminar Neo': 'luminar-neo',
  PhotoRoom: 'photoroom',
  Clipdrop: 'clipdrop',
  'Playground AI': 'playground-ai',
  'Recraft AI': 'recraft-ai',
  Runway: 'runway',
  Pika: 'pika',
  'Luma Dream Machine': 'luma-dream-machine',
  Sora: 'sora',
  HeyGen: 'heygen',
  '可灵 Kling': 'kling',
  '即梦 Seedance': 'seedance',
  Vidu: 'vidu',
  Synthesia: 'synthesia',
  'D-ID': 'd-id',
  Colossyan: 'colossyan',
  'InVideo AI': 'invideo-ai',
  Captions: 'captions',
  Descript: 'descript',
  'Opus Clip': 'opus-clip',
  'Veed.io': 'veed-io',
  'CapCut Pro / 剪映': 'capcut-pro',
  PixVerse: 'pixverse',
  '海螺视频 Hailuo': 'hailuo-video',
  海螺视频: 'hailuo-video',
  智谱清影: 'qingying',
  Suno: 'suno',
  Udio: 'udio',
  ElevenLabs: 'elevenlabs',
  AIVA: 'aiva',
  Boomy: 'boomy',
  Soundraw: 'soundraw',
  Mubert: 'mubert',
  'Murf AI': 'murf-ai',
  'Play.ht': 'play-ht',
  Speechify: 'speechify',
  'Notion AI': 'notion-ai',
  'Grammarly Premium': 'grammarly-premium',
  Jasper: 'jasper',
  'Copy.ai': 'copy-ai',
  Writesonic: 'writesonic',
  QuillBot: 'quillbot',
  'DeepL Pro': 'deepl-pro',
  Gamma: 'gamma',
  Tome: 'tome',
  'Beautiful.ai': 'beautiful-ai',
  'Taskade AI': 'taskade-ai',
  'Coda AI': 'coda-ai',
  'Otter.ai': 'otter-ai',
  'Fireflies.ai': 'fireflies-ai',
  Krisp: 'krisp',
  Elicit: 'elicit',
  Consensus: 'consensus',
  'You.com': 'you-com',
  'Figma AI': 'figma-ai',
  'Adobe Creative Cloud': 'adobe-cc',
  '美图秀秀 AI': 'meitu-ai',
  Wink: 'wink',
  'Framer AI': 'framer-ai',
  'Galileo AI': 'galileo-ai',
  Uizard: 'uizard',
  Looka: 'looka',
  'Duolingo Max': 'duolingo-max',
  Khanmigo: 'khanmigo',
  'Photomath Plus': 'photomath-plus',
  'Gauth AI': 'gauth-ai',
  'Question AI': 'question-ai',
  Calm: 'calm',
  Headspace: 'headspace',
  Noom: 'noom',
  'MyFitnessPal Premium': 'myfitnesspal',
  'Rabbit R1': 'rabbit-r1',
  'Humane AI Pin': 'humane-ai-pin',
  'Friend（AI 挂件）': 'friend-pendant',
  'Meta Ray-Ban（AI 功能）': 'meta-rayban-ai',
}

export function resolveSheetProductId(name) {
  const raw = String(name || '').trim()
  if (!raw) return null
  if (SHEET_NAME_TO_ID[raw]) return SHEET_NAME_TO_ID[raw]
  // fuzzy: strip spaces / brackets
  const compact = raw.replace(/\s+/g, '')
  for (const [k, id] of Object.entries(SHEET_NAME_TO_ID)) {
    if (k.replace(/\s+/g, '') === compact) return id
  }
  return null
}

/** True when sheet says there is a usable free tier (not trial-only / 无免费). */
export function sheetHasFreeTier(freeTrial) {
  const s = String(freeTrial || '').trim()
  if (!s) return false
  if (/无免费|无独立|已停服|不单独/.test(s)) return false
  if (/^免费试用|^试用/.test(s) && !/^免费(?!试用)/.test(s)) return false
  if (/免费额度|免费设计/.test(s)) return true
  if (/^免费/.test(s) || s.includes('免费（') || s === '免费') return true
  if (s.includes('Hobby')) return true // Cursor Hobby
  return false
}
