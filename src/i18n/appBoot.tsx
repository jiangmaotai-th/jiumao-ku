import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { applyDocumentMeta, initLocale, t } from './index'
import { I18nProvider } from './react'

/** Boot a React SPA with shared locale detection (same mw_lang as homepage). */
export function bootReactApp(
  App: ComponentType,
  meta?: { titleKey?: string; descriptionKey?: string },
) {
  initLocale()
  if (meta?.titleKey) document.title = t(meta.titleKey)
  if (meta?.descriptionKey) {
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t(meta.descriptionKey))
  } else {
    applyDocumentMeta()
  }

  const root = document.getElementById('root')
  if (!root) throw new Error('root missing')

  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  )
}
