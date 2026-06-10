import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The `/holdem-static-page/` subpath is only for the GitHub Pages build.
// Local dev (serve) and Vercel both serve from the root, where `/api/*` lives.
export default defineConfig(({ command }) => ({
  base: command === 'serve' || process.env.VERCEL ? '/' : '/holdem-static-page/',
  plugins: [react(), tailwindcss()],
}))
