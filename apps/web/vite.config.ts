import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

const apiProxy = process.env.API_PROXY ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  esbuild: {
    keepNames: true,
  },
  build: {
    minify: 'esbuild',
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/auth': apiProxy,
      '/api': apiProxy,
    },
  },
})
