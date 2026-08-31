import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { idbReady } from './utils/idbStore'

// Silently reload as soon as a newer build's service worker takes over — sw.ts already
// calls skipWaiting()+clientsClaim() so the new SW activates immediately, but without this
// the already-loaded page keeps running the old JS in memory until reloaded, so a stale
// build can otherwise persist indefinitely on a device that's never fully closed.
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
})

idbReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
