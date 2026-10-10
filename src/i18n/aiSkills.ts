/**
 * UI copy for the「AI 最新 Skill」board (homepage + /ai/).
 *
 * Kept in its own module (like ./aiDaily) so the shared locales chunk stays
 * untouched. Skill names, summaries and how-tos stay Chinese — only chrome
 * (titles, labels, buttons) is translated here.
 */
import type { Locale } from './types'
import type { AiSkillSourceType } from '../ai-skills/types'

export type AiSkillsMessages = {
  title: string
  kicker: string
  lead: string
  viewAll: string
  /** `{n}` = number of cards hidden on the homepage for that platform. */
  morePlatform: string
  loading: string
  loadFailed: string
  empty: string
  /** `{time}` = Beijing wall time of `updatedAt`. */
  updated: string
  source: string
  related: string
  howTo: string
  /** Shown on non-Chinese locales: content is Chinese. Empty for zh. */
  contentNote: string
  rail: string
  sourceTypes: Record<AiSkillSourceType, string>
  /** Platform labels that need translating; brand names fall through as-is. */
  platforms: Record<string, string>
}

const zhCN: AiSkillsMessages = {
  title: 'AI 最新 Skill',
  kicker: 'SKILLS · 官方 + X + 社区，每天更新',
  lead: 'Claude、ChatGPT、Gemini、Cursor 等热门 AI 的新技能、插件和扩展，官方发布和社区推荐都收，每条都附来源和用法。',
  viewAll: '查看全部 →',
  morePlatform: '还有 {n} 条，查看全部 →',
  loading: 'Skill 清单加载中…',
  loadFailed: 'Skill 清单暂时没有加载出来，稍后刷新试试。',
  empty: '今天的 Skill 清单还在整理。',
  updated: '更新于 {time}（北京时间）',
  source: '来源',
  related: '相关',
  howTo: '怎么用',
  contentNote: '',
  rail: 'AI 最新 Skill',
  sourceTypes: {
    official: '官方',
    x: 'X 推荐',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: '社区',
  },
  platforms: { 通用: '通用 · 多平台' },
}

const zhTW: AiSkillsMessages = {
  title: 'AI 最新 Skill',
  kicker: 'SKILLS · 官方 + X + 社群，每天更新',
  lead: 'Claude、ChatGPT、Gemini、Cursor 等熱門 AI 的新技能、外掛與擴充功能，官方發布與社群推薦都收錄，每條附來源和用法。',
  viewAll: '查看全部 →',
  morePlatform: '還有 {n} 條，查看全部 →',
  loading: 'Skill 清單載入中…',
  loadFailed: 'Skill 清單暫時沒有載入，稍後重新整理試試。',
  empty: '今天的 Skill 清單還在整理。',
  updated: '更新於 {time}（北京時間）',
  source: '來源',
  related: '相關',
  howTo: '怎麼用',
  contentNote: '內容以簡體中文撰寫。',
  rail: 'AI 最新 Skill',
  sourceTypes: {
    official: '官方',
    x: 'X 推薦',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: '社群',
  },
  platforms: { 通用: '通用 · 多平台' },
}

const en: AiSkillsMessages = {
  title: 'Latest AI Skills',
  kicker: 'SKILLS · Official + X + community, daily',
  lead: 'New skills, plugins and extensions for Claude, ChatGPT, Gemini, Cursor and more — official releases and community picks, each with a source and how to use it.',
  viewAll: 'See all →',
  morePlatform: '{n} more — see all →',
  loading: 'Loading skills…',
  loadFailed: 'The skills list didn’t load. Please refresh in a moment.',
  empty: 'Today’s skills list is still being put together.',
  updated: 'Updated {time} (Beijing time)',
  source: 'Source',
  related: 'Related',
  howTo: 'How to use',
  contentNote: 'Entries are written in Chinese.',
  rail: 'AI skills',
  sourceTypes: {
    official: 'Official',
    x: 'Picked on X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'Community',
  },
  platforms: { 通用: 'Cross-platform' },
}

const ja: AiSkillsMessages = {
  title: 'AI 最新スキル',
  kicker: 'SKILLS · 公式 + X + コミュニティ、毎日更新',
  lead: 'Claude・ChatGPT・Gemini・Cursor など人気 AI の新しいスキル、プラグイン、拡張機能。公式発表もコミュニティのおすすめも、出典と使い方つきで。',
  viewAll: 'すべて見る →',
  morePlatform: 'ほか {n} 件 · すべて見る →',
  loading: 'スキル一覧を読み込み中…',
  loadFailed: 'スキル一覧を読み込めませんでした。少し後で再読み込みしてください。',
  empty: '今日のスキル一覧はまだ準備中です。',
  updated: '{time} 更新（北京時間）',
  source: '出典',
  related: '関連',
  howTo: '使い方',
  contentNote: '内容は中国語で書かれています。',
  rail: 'AI スキル',
  sourceTypes: {
    official: '公式',
    x: 'X で話題',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'コミュニティ',
  },
  platforms: { 通用: 'マルチプラットフォーム' },
}

const ko: AiSkillsMessages = {
  title: 'AI 최신 스킬',
  kicker: 'SKILLS · 공식 + X + 커뮤니티, 매일 업데이트',
  lead: 'Claude, ChatGPT, Gemini, Cursor 등 인기 AI의 새 스킬·플러그인·확장 기능. 공식 발표와 커뮤니티 추천을 출처와 사용법과 함께 모았습니다.',
  viewAll: '전체 보기 →',
  morePlatform: '{n}개 더 · 전체 보기 →',
  loading: '스킬 목록을 불러오는 중…',
  loadFailed: '스킬 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.',
  empty: '오늘의 스킬 목록을 정리하는 중입니다.',
  updated: '{time} 업데이트 (베이징 시간)',
  source: '출처',
  related: '관련',
  howTo: '사용법',
  contentNote: '내용은 중국어로 작성되어 있습니다.',
  rail: 'AI 스킬',
  sourceTypes: {
    official: '공식',
    x: 'X 추천',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: '커뮤니티',
  },
  platforms: { 通用: '멀티 플랫폼' },
}

const fr: AiSkillsMessages = {
  title: 'Derniers skills IA',
  kicker: 'SKILLS · Officiel + X + communauté, chaque jour',
  lead: 'Nouveaux skills, plugins et extensions pour Claude, ChatGPT, Gemini, Cursor et d’autres — annonces officielles et choix de la communauté, avec source et mode d’emploi.',
  viewAll: 'Tout voir →',
  morePlatform: '{n} de plus — tout voir →',
  loading: 'Chargement des skills…',
  loadFailed: 'La liste n’a pas pu être chargée. Réessayez dans un instant.',
  empty: 'La liste du jour est encore en préparation.',
  updated: 'Mis à jour le {time} (heure de Pékin)',
  source: 'Source',
  related: 'Voir aussi',
  howTo: 'Mode d’emploi',
  contentNote: 'Les entrées sont rédigées en chinois.',
  rail: 'Skills IA',
  sourceTypes: {
    official: 'Officiel',
    x: 'Repéré sur X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'Communauté',
  },
  platforms: { 通用: 'Multiplateforme' },
}

const de: AiSkillsMessages = {
  title: 'Neueste KI-Skills',
  kicker: 'SKILLS · Offiziell + X + Community, täglich',
  lead: 'Neue Skills, Plugins und Erweiterungen für Claude, ChatGPT, Gemini, Cursor und mehr – offizielle Releases und Community-Tipps, jeweils mit Quelle und Anleitung.',
  viewAll: 'Alle ansehen →',
  morePlatform: '{n} weitere – alle ansehen →',
  loading: 'Skills werden geladen…',
  loadFailed: 'Die Liste konnte nicht geladen werden. Bitte gleich neu laden.',
  empty: 'Die heutige Liste wird noch zusammengestellt.',
  updated: 'Aktualisiert {time} (Pekinger Zeit)',
  source: 'Quelle',
  related: 'Siehe auch',
  howTo: 'So geht’s',
  contentNote: 'Die Einträge sind auf Chinesisch verfasst.',
  rail: 'KI-Skills',
  sourceTypes: {
    official: 'Offiziell',
    x: 'Tipp auf X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'Community',
  },
  platforms: { 通用: 'Plattformübergreifend' },
}

const es: AiSkillsMessages = {
  title: 'Últimos skills de IA',
  kicker: 'SKILLS · Oficial + X + comunidad, cada día',
  lead: 'Nuevos skills, plugins y extensiones para Claude, ChatGPT, Gemini, Cursor y más: lanzamientos oficiales y recomendaciones de la comunidad, con fuente y modo de uso.',
  viewAll: 'Ver todo →',
  morePlatform: '{n} más — ver todo →',
  loading: 'Cargando skills…',
  loadFailed: 'No se pudo cargar la lista. Actualiza en un momento.',
  empty: 'La lista de hoy aún se está preparando.',
  updated: 'Actualizado {time} (hora de Pekín)',
  source: 'Fuente',
  related: 'Relacionado',
  howTo: 'Cómo usarlo',
  contentNote: 'Las entradas están escritas en chino.',
  rail: 'Skills de IA',
  sourceTypes: {
    official: 'Oficial',
    x: 'Recomendado en X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'Comunidad',
  },
  platforms: { 通用: 'Multiplataforma' },
}

const hi: AiSkillsMessages = {
  title: 'नवीनतम AI स्किल्स',
  kicker: 'SKILLS · आधिकारिक + X + कम्युनिटी, रोज़ अपडेट',
  lead: 'Claude, ChatGPT, Gemini, Cursor और अन्य लोकप्रिय AI के नए स्किल, प्लगइन और एक्सटेंशन — आधिकारिक रिलीज़ और कम्युनिटी सुझाव, स्रोत और उपयोग के तरीके के साथ।',
  viewAll: 'सभी देखें →',
  morePlatform: '{n} और — सभी देखें →',
  loading: 'स्किल सूची लोड हो रही है…',
  loadFailed: 'स्किल सूची लोड नहीं हुई। थोड़ी देर बाद रीफ़्रेश करें।',
  empty: 'आज की स्किल सूची अभी तैयार हो रही है।',
  updated: '{time} को अपडेट (बीजिंग समय)',
  source: 'स्रोत',
  related: 'संबंधित',
  howTo: 'कैसे इस्तेमाल करें',
  contentNote: 'प्रविष्टियाँ चीनी भाषा में लिखी गई हैं।',
  rail: 'AI स्किल्स',
  sourceTypes: {
    official: 'आधिकारिक',
    x: 'X पर सुझाया गया',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'कम्युनिटी',
  },
  platforms: { 通用: 'मल्टी-प्लेटफ़ॉर्म' },
}

const th: AiSkillsMessages = {
  title: 'สกิล AI ล่าสุด',
  kicker: 'SKILLS · ทางการ + X + ชุมชน อัปเดตทุกวัน',
  lead: 'สกิล ปลั๊กอิน และส่วนขยายใหม่ของ Claude, ChatGPT, Gemini, Cursor และอื่น ๆ ทั้งประกาศทางการและที่ชุมชนแนะนำ พร้อมแหล่งที่มาและวิธีใช้',
  viewAll: 'ดูทั้งหมด →',
  morePlatform: 'อีก {n} รายการ · ดูทั้งหมด →',
  loading: 'กำลังโหลดรายการสกิล…',
  loadFailed: 'โหลดรายการสกิลไม่สำเร็จ ลองรีเฟรชอีกครั้งในอีกสักครู่',
  empty: 'รายการสกิลของวันนี้ยังอยู่ระหว่างจัดเตรียม',
  updated: 'อัปเดต {time} (เวลาปักกิ่ง)',
  source: 'แหล่งที่มา',
  related: 'ที่เกี่ยวข้อง',
  howTo: 'วิธีใช้',
  contentNote: 'เนื้อหาเขียนเป็นภาษาจีน',
  rail: 'สกิล AI',
  sourceTypes: {
    official: 'ทางการ',
    x: 'แนะนำบน X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'ชุมชน',
  },
  platforms: { 通用: 'หลายแพลตฟอร์ม' },
}

const ru: AiSkillsMessages = {
  title: 'Новые AI-скиллы',
  kicker: 'SKILLS · Официально + X + сообщество, ежедневно',
  lead: 'Новые скиллы, плагины и расширения для Claude, ChatGPT, Gemini, Cursor и других — официальные релизы и находки сообщества, с источником и инструкцией.',
  viewAll: 'Смотреть всё →',
  morePlatform: 'Ещё {n} — смотреть всё →',
  loading: 'Загружаем список скиллов…',
  loadFailed: 'Не удалось загрузить список. Обновите страницу чуть позже.',
  empty: 'Сегодняшний список ещё готовится.',
  updated: 'Обновлено {time} (пекинское время)',
  source: 'Источник',
  related: 'См. также',
  howTo: 'Как использовать',
  contentNote: 'Записи написаны на китайском.',
  rail: 'AI-скиллы',
  sourceTypes: {
    official: 'Официально',
    x: 'Советуют в X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'Сообщество',
  },
  platforms: { 通用: 'Кроссплатформенные' },
}

const pt: AiSkillsMessages = {
  title: 'Skills de IA mais recentes',
  kicker: 'SKILLS · Oficial + X + comunidade, todo dia',
  lead: 'Novos skills, plugins e extensões para Claude, ChatGPT, Gemini, Cursor e mais — lançamentos oficiais e indicações da comunidade, com fonte e modo de uso.',
  viewAll: 'Ver tudo →',
  morePlatform: 'Mais {n} — ver tudo →',
  loading: 'Carregando skills…',
  loadFailed: 'Não foi possível carregar a lista. Atualize em instantes.',
  empty: 'A lista de hoje ainda está sendo preparada.',
  updated: 'Atualizado {time} (horário de Pequim)',
  source: 'Fonte',
  related: 'Relacionado',
  howTo: 'Como usar',
  contentNote: 'As entradas estão escritas em chinês.',
  rail: 'Skills de IA',
  sourceTypes: {
    official: 'Oficial',
    x: 'Indicado no X',
    github: 'GitHub',
    reddit: 'Reddit',
    hn: 'Hacker News',
    other: 'Comunidade',
  },
  platforms: { 通用: 'Multiplataforma' },
}

export const aiSkillsMessages: Record<Locale, AiSkillsMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
  ko,
  fr,
  de,
  es,
  hi,
  th,
  ru,
  pt,
}
