import { useLanguageSwitcher } from './react'

/** Place once in each app header: <LangSwitchHost /> */
export function LangSwitchHost({ id = 'lang-switch' }: { id?: string }) {
  useLanguageSwitcher(id)
  return <div id={id} />
}
