import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  build: { rolldownOptions: { input: { main: 'index.html', voice: 'voice-session.html' } } },
  plugins: [react(), tailwindcss()],
})
