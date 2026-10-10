import { trackView } from '../analytics'
import { bootReactApp } from '../i18n/appBoot'
import { App } from './App'
import './styles.css'

trackView('magic-markdown')

bootReactApp(App, {
  titleKey: 'markdown.metaTitle',
  descriptionKey: 'markdown.metaDescription',
})
