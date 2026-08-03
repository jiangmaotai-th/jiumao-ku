import '../styles/main.css'
import './styles.css'
import { initLocale, t, tList } from '../i18n'
import { mountLanguageSwitcher } from '../i18n/switcher'

initLocale()
document.title = t('legal.metaTitle')
document
  .querySelector('meta[name="description"]')
  ?.setAttribute('content', t('legal.metaDescription'))

const year = String(new Date().getFullYear())
const root = document.getElementById('legal-root')
if (!root) throw new Error('legal-root missing')

root.innerHTML = `
  <header class="site-header">
    <div class="brand-block">
      <a class="brand-mark" href="/">${t('common.brand')}</a>
      <p class="brand-domain">maotaiworks.com</p>
    </div>
    <div class="site-header__right">
      <nav class="legal-nav" aria-label="legal">
        <a href="#copyright">${t('legal.navCopyright')}</a>
        <a href="#terms">${t('legal.navTerms')}</a>
        <a href="#privacy">${t('legal.navPrivacy')}</a>
        <a href="#credits">${t('legal.navCredits')}</a>
      </nav>
      <div id="lang-switch"></div>
    </div>
  </header>

  <main class="legal-main">
    <h1 class="legal-title">${t('legal.title')}</h1>
    <p class="legal-lead">${t('legal.lead')}</p>
    <p class="legal-updated">${t('legal.updated')}</p>

    <section id="copyright" class="legal-section">
      <h2>${t('legal.copyrightTitle')}</h2>
      <p>${t('legal.copyrightP1', { year })}</p>
      <p>${t('legal.copyrightP2')}</p>
      <p>${t('legal.copyrightP3')}</p>
    </section>

    <section id="terms" class="legal-section">
      <h2>${t('legal.termsTitle')}</h2>
      <ol>
        ${tList('legal.terms').map((item) => `<li>${item}</li>`).join('')}
      </ol>
    </section>

    <section id="privacy" class="legal-section">
      <h2>${t('legal.privacyTitle')}</h2>
      <h3>${t('legal.privacyLocalTitle')}</h3>
      <p>${t('legal.privacyLocalBody')}</p>
      <h3>${t('legal.privacyUploadTitle')}</h3>
      <ul>
        ${tList('legal.privacyUploadItems').map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <p>${t('legal.privacyUploadNote')}</p>
      <h3>${t('legal.privacyOtherTitle')}</h3>
      <ul>
        ${tList('legal.privacyOtherItems').map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <p>${t('legal.privacyTip')}</p>
    </section>

    <section id="credits" class="legal-section">
      <h2>${t('legal.creditsTitle')}</h2>
      <p>${t('legal.creditsIntro')}</p>
      <ul class="credit-list">
        <li><strong>FFmpeg</strong>（LGPL/GPL）</li>
        <li><strong>ffmpeg.wasm</strong></li>
        <li><strong>Calibre</strong>（GPL）</li>
        <li><strong>Tesseract OCR</strong> / <strong>OCRmyPDF</strong></li>
        <li><strong>PDF.js</strong>、<strong>pdf-lib</strong></li>
        <li><strong>JSZip</strong>、<strong>Mammoth</strong></li>
        <li><strong>React</strong>、<strong>Vite</strong></li>
      </ul>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-left">
      <p class="footer-brand">${t('common.brand')}</p>
    </div>
    <p class="footer-meta">
      <a href="/">${t('common.backHome')}</a>
      <span aria-hidden="true">·</span>
      <span>© ${year} ${t('common.copyright')}</span>
    </p>
  </footer>
`

mountLanguageSwitcher(document.getElementById('lang-switch'))
