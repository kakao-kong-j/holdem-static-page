import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vercel serves from the root domain; GitHub Pages uses the repo subpath.
const base = process.env.VERCEL ? '/' : '/holdem-static-page/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
