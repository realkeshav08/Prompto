import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import toast from 'react-hot-toast'

import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { AppContextProvider } from './context'
import './index.css'

// Guard: fail with a clear message if the mount node is missing, instead of a
// cryptic "Cannot read properties of null (reading 'render')".
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found — check index.html')
}

// Apply the saved theme BEFORE the first React paint, so the initial render
// already matches the user's theme. Without this the app briefly renders in the
// light default (a white flash) until AppContextProvider's effect runs after
// mount. Runtime theme switches are still handled inside AppContextProvider.
const savedTheme = localStorage.getItem('theme') || 'dark'
document.documentElement.classList.toggle('dark', savedTheme === 'dark')

createRoot(rootElement).render(
  <StrictMode>
    {/* App-level safety net: any uncaught render error shows this fallback
        instead of a blank white screen. */}
    <ErrorBoundary
      fallback={
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
          Something went wrong. Please refresh the page.
        </div>
      }
    >
      <BrowserRouter>
        <AppContextProvider>
          <App />
        </AppContextProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)

/* PWA registration. The worker is built with autoUpdate, so a new deploy
   installs and claims the page itself — there is no waiting worker to prompt
   about. `immediate` registers on load rather than after the window settles, so
   a client on an old build picks the new one up on the very next visit.

   An update swaps the precache under a page that already loaded its assets, so
   the tab is reloaded once when that happens; without it the running code and
   the cached bundle can disagree, which is what produced the broken layout. */
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing
      if (!incoming) return
      incoming.addEventListener('statechange', () => {
        // 'activated' with an existing controller means this replaced a previous
        // worker — a first install has no controller and needs no reload.
        if (incoming.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload()
        }
      })
    })
  },
  onOfflineReady() {
    toast.success('Ready to work offline')
  },
})
