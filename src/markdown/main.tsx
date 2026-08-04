import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { trackView } from '../analytics'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('root missing')

trackView('magic-markdown')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
