/**
 * Nintendo eShop storefronts.
 * region: which NSUID bucket to use (na | eu | jp | kr | hk)
 */
export const STOREFRONTS = [
  { code: 'us', name: '美国', currency: 'USD', flag: '🇺🇸', region: 'na' },
  { code: 'ca', name: '加拿大', currency: 'CAD', flag: '🇨🇦', region: 'na' },
  { code: 'mx', name: '墨西哥', currency: 'MXN', flag: '🇲🇽', region: 'na' },
  { code: 'br', name: '巴西', currency: 'BRL', flag: '🇧🇷', region: 'na' },
  { code: 'ar', name: '阿根廷', currency: 'ARS', flag: '🇦🇷', region: 'na' },
  { code: 'cl', name: '智利', currency: 'CLP', flag: '🇨🇱', region: 'na' },
  { code: 'co', name: '哥伦比亚', currency: 'COP', flag: '🇨🇴', region: 'na' },
  { code: 'pe', name: '秘鲁', currency: 'PEN', flag: '🇵🇪', region: 'na' },
  { code: 'gb', name: '英国', currency: 'GBP', flag: '🇬🇧', region: 'eu' },
  { code: 'ie', name: '爱尔兰', currency: 'EUR', flag: '🇮🇪', region: 'eu' },
  { code: 'de', name: '德国', currency: 'EUR', flag: '🇩🇪', region: 'eu' },
  { code: 'fr', name: '法国', currency: 'EUR', flag: '🇫🇷', region: 'eu' },
  { code: 'it', name: '意大利', currency: 'EUR', flag: '🇮🇹', region: 'eu' },
  { code: 'es', name: '西班牙', currency: 'EUR', flag: '🇪🇸', region: 'eu' },
  { code: 'nl', name: '荷兰', currency: 'EUR', flag: '🇳🇱', region: 'eu' },
  { code: 'pl', name: '波兰', currency: 'PLN', flag: '🇵🇱', region: 'eu' },
  { code: 'se', name: '瑞典', currency: 'SEK', flag: '🇸🇪', region: 'eu' },
  { code: 'no', name: '挪威', currency: 'NOK', flag: '🇳🇴', region: 'eu' },
  { code: 'ch', name: '瑞士', currency: 'CHF', flag: '🇨🇭', region: 'eu' },
  { code: 'za', name: '南非', currency: 'ZAR', flag: '🇿🇦', region: 'eu' },
  { code: 'au', name: '澳大利亚', currency: 'AUD', flag: '🇦🇺', region: 'eu' },
  { code: 'nz', name: '新西兰', currency: 'NZD', flag: '🇳🇿', region: 'eu' },
  { code: 'jp', name: '日本', currency: 'JPY', flag: '🇯🇵', region: 'jp' },
  { code: 'kr', name: '韩国', currency: 'KRW', flag: '🇰🇷', region: 'kr' },
  { code: 'hk', name: '香港', currency: 'HKD', flag: '🇭🇰', region: 'hk' },
  { code: 'tw', name: '台湾', currency: 'TWD', flag: '🇹🇼', region: 'hk' },
]

export const STOREFRONT_MAP = Object.fromEntries(STOREFRONTS.map((s) => [s.code, s]))

/** Representative country used when discovering NSUIDs for a region bucket. */
export const REGION_PROBE = {
  na: 'US',
  eu: 'DE',
  jp: 'JP',
  kr: 'KR',
  hk: 'HK',
}

export const QUICK_COUNTRY_CODES = [
  'us',
  'ca',
  'mx',
  'br',
  'ar',
  'gb',
  'de',
  'pl',
  'za',
  'au',
  'jp',
  'kr',
  'hk',
  'tw',
]
