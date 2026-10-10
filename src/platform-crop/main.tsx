import { App } from './App'
import './styles.css'
import { bootReactApp } from '../i18n/appBoot'

bootReactApp(App, {
  titleKey: 'platformCrop.metaTitle',
  descriptionKey: 'platformCrop.metaDescription',
})
