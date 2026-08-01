/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Turns the app into an installable PWA (Android/iOS "Add to Home Screen").
    // Generates a service worker (offline precache) + web app manifest.
    VitePWA({
      /* autoUpdate, not prompt. Under 'prompt' the new worker sits in `waiting`
         until the user accepts a toast, so anyone who ignored it kept being
         served the previous build on every reload — a fix could be deployed and
         never reach them. The app holds no unsaved client state (messages are
         persisted server-side), so taking control immediately is safe and means
         a reload always gets current code. */
      registerType: 'autoUpdate',
      injectRegister: null,         // we register manually in main.jsx (virtual:pwa-register)
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Prompto — Your AI Study Partner',
        short_name: 'Prompto',
        description: 'Your AI study partner — upload notes, ask questions, and get clear explanations for any subject.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',      // opens like a native app (no browser chrome)
        orientation: 'portrait',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // 'maskable' = Android crops icons into a shape; this one has safe-zone padding.
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          // SVG fallback for browsers that prefer a scalable icon.
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',       // SPA: any route falls back to the shell
        navigateFallbackDenylist: [/^\/api/],  // never serve the shell for API paths
        // Take over from the previous worker on activation instead of waiting
        // for every tab to close, and drop its precache so no stale asset
        // survives the upgrade.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
      // PWA stays OFF in `npm run dev` so it never interferes with HMR.
      devOptions: { enabled: false },
    }),
  ],
  // Vitest configuration (shares Vite's transform pipeline so tests run
  // through the same React/Tailwind setup as the real app).
  test: {
    globals: true,            // describe/it/expect available without imports
    environment: 'jsdom',     // simulate a browser DOM for React component tests
    setupFiles: './src/test/setup.js',
    css: true,                // don't choke on imported .css files
  },
})
