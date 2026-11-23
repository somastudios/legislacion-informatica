import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Base relativa: el mismo build sirve en GitHub Pages (/legislacion-informatica/) y en local.
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  server: { port: 5173, strictPort: true },
})
