import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/dictionary': {
        target: 'https://api.dictionaryapi.dev',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/dictionary/, '/api/v2/entries/en'),
      },
    },
  },
})
