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

// PWA: when a new version is deployed, prompt the user to reload (instead of
// silently swapping the service worker mid-session).
const updateSW = registerSW({
  onNeedRefresh() {
    toast(
      (t) => (
        <span>
          A new version is available.{' '}
          <button
            onClick={() => { toast.dismiss(t.id); updateSW(true) }}
            style={{ textDecoration: 'underline', fontWeight: 600 }}
          >
            Reload
          </button>
        </span>
      ),
      { duration: Infinity }
    )
  },
  onOfflineReady() {
    toast.success('Ready to work offline')
  },
})
