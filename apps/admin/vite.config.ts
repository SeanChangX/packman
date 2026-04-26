import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

const apiProxy = process.env.API_PROXY ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  server: {
    host: true,
    port: 3001,
    proxy: {
      '/auth': apiProxy,
      '/api': apiProxy,
    },
  },
})
