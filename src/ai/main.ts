import '../styles/main.css'
import '../ai-daily/board.css'
import { mountAiDaily } from '../ai-daily/render'

const yearEl = document.querySelector<HTMLElement>('#year')
if (yearEl) yearEl.textContent = String(new Date().getFullYear())

void mountAiDaily()
