import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installViewportFix } from './viewportFix'

installViewportFix()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: cache app shell & gambar di perangkat (W-15, .agents/decisions.md D-13).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
    // Minta storage persisten agar iOS tidak cepat mengosongkan cache (boleh ditolak).
    navigator.storage?.persist?.().catch(() => {})
  })
}

