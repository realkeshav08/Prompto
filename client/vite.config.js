/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
