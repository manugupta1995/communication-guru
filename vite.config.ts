import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single Vite process. Both layers (Delivery + Arrangement) are now scored
// entirely in the browser — no API, no key, no network. To upgrade Arrangement
// to an LLM later, add a configureServer middleware plugin here for /api and
// swap scoreArrangement() in App.tsx for a fetch. See README.
export default defineConfig({
  // Relative asset paths so the build works at any subpath
  // (e.g. GitHub Pages project page /communication-guru/).
  base: './',
  plugins: [react()],
  server: { port: 5173 },
})
