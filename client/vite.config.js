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
      registerType: 'prompt',       // new deploy → notify user (toast) instead of silent reload
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
