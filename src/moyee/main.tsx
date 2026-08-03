import { App } from './App'
import './styles.css'
import { bootReactApp } from '../i18n/appBoot'

bootReactApp(App, {
  titleKey: 'moyee.metaTitle',
  descriptionKey: 'moyee.metaDescription',
})
