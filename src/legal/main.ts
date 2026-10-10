import '../styles/main.css'
import './styles.css'
import { initLocale, localizedHref, t, tList } from '../i18n'
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
      <a class="brand-mark" href="${localizedHref('/')}">${t('common.brand')}</a>
      <p class="brand-domain">maotaiworks.com</p>
    </div>
    <div class="site-header__right">
      <nav class="legal-nav" aria-label="legal">
        <a href="#copyright">${t('legal.navCopyright')}</a>
        <a href="#terms">${t('legal.navTerms')}</a>
        <a href="#privacy">${t('legal.navPrivacy')}</a>
        <a href="#credits">${t('legal.navCredits')}</a>
        <a href="#contact">${t('legal.navContact')}</a>
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
        <li><strong>MarkItDown</strong>（Microsoft，MIT）</li>
        <li><strong>FFmpeg</strong>（LGPL/GPL）</li>
        <li><strong>ffmpeg.wasm</strong></li>
        <li><strong>Calibre</strong>（GPL）</li>
        <li><strong>Tesseract OCR</strong> / <strong>OCRmyPDF</strong></li>
        <li><strong>PDF.js</strong>、<strong>pdf-lib</strong></li>
        <li><strong>JSZip</strong>、<strong>Mammoth</strong></li>
        <li><strong>React</strong>、<strong>Vite</strong></li>
      </ul>
    </section>

    <section id="contact" class="legal-section">
      <h2>${t('legal.contactTitle')}</h2>
      <p class="contact-line">
        <a class="contact-link" href="mailto:jiangyiqiu21@gmail.com">
          <svg class="contact-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 4-8 5L4 8V6l8 5 8-5v2Z"/>
          </svg>
          <span>${t('legal.contactEmailLabel')}: jiangyiqiu21@gmail.com</span>
        </a>
      </p>
      <p class="contact-line">
        <a class="contact-link" href="https://t.me/Maotaijiang" target="_blank" rel="noopener noreferrer">
          <svg class="contact-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M11.94 15.5 9.4 17.84l-.34-3.9L17.76 7.1c.3-.2-.07-.33-.46-.14L7.1 12.7 3.4 11.56c-.8-.25-.81-.78.17-1.16L19.55 4.8c.66-.28 1.3.16 1.07 1.18l-2.75 12.96c-.19.9-.74 1.12-1.5.7l-4.15-3.06-.16.16Z"/>
          </svg>
          <span>${t('legal.contactTelegramLabel')}: @Maotaijiang</span>
        </a>
      </p>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-left">
      <p class="footer-brand">${t('common.brand')}</p>
    </div>
    <p class="footer-meta">
      <a href="${localizedHref('/')}">${t('common.backHome')}</a>
      <span aria-hidden="true">·</span>
      <span>© ${year} ${t('common.copyright')}</span>
    </p>
  </footer>
`

mountLanguageSwitcher(document.getElementById('lang-switch'))
void import('../note/widget').then((m) => m.mountNoteWidget()).catch(() => {})
