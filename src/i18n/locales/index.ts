import type { Locale, Messages } from '../types'
import zhCN from './zh-CN'
import zhTW from './zh-TW'
import en from './en'
import ja from './ja'
import ko from './ko'
import fr from './fr'
import de from './de'
import es from './es'
import hi from './hi'
import th from './th'
import ru from './ru'
import pt from './pt'

export const messages: Record<Locale, Messages> = {
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
