import { applyDocumentMeta, initLocale, t } from '../i18n'
import { trackView } from '../analytics'
import { startGoose } from './game.js'
import './styles.css'

initLocale()
document.title = t('goose.metaTitle')
const desc = document.querySelector('meta[name="description"]')
if (desc) desc.setAttribute('content', t('goose.metaDescription'))
else applyDocumentMeta()
trackView('ring-goose')

const app = document.querySelector('#app')
await startGoose(app)
