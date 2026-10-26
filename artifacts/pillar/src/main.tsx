import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { applyPersonaFromUrl } from './lib/persona'
import './index.css'

// Demo deep links: `?as=<persona>` opens the app viewing as that person, then leaves the URL clean.
applyPersonaFromUrl(import.meta.env.BASE_URL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Dev-only handle for scripted checks of the demo flows (file pickers can't be driven by tests).
if (import.meta.env.DEV) {
  import('./lib/store').then(({ useStore }) => Object.assign(window, { __pillar: useStore }))
}
