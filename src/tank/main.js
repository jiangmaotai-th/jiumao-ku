import { applyDocumentMeta, initLocale, t } from '../i18n'
import { trackView } from '../analytics'
import { startTank } from './app.js'
import './styles.css'

initLocale()
document.title = t('tank.metaTitle')
const desc = document.querySelector('meta[name="description"]')
if (desc) desc.setAttribute('content', t('tank.metaDescription'))
else applyDocumentMeta()
trackView('idle-tank')

const app = document.querySelector('#app')
await startTank(app)
