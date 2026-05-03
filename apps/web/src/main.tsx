import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ToastProvider } from '@packman/ui'
import { AuthProvider } from './lib/auth-context'
import { ThemeProvider } from './lib/theme-context'
import { LocaleProvider } from './lib/i18n'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

// Eruda mobile DevTools — opt-in only via ?debug=1 (sticky in localStorage so
// it survives navigation). Loaded from CDN at runtime so it ships zero bytes
// to ordinary visitors. Use ?debug=0 to turn it off again.
{
  try {
    const url = new URL(window.location.href)
    const flag = url.searchParams.get('debug')
    if (flag === '1') localStorage.setItem('packman:debug', '1')
    if (flag === '0') localStorage.removeItem('packman:debug')
    if (localStorage.getItem('packman:debug') === '1') {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/eruda@3'
      script.onload = () => {
        const eruda = (window as unknown as { eruda?: { init: () => void } }).eruda
        eruda?.init()
      }
      document.head.appendChild(script)
    }
  } catch {
    // localStorage / URL parsing unavailable; debug flag is optional, skip silently.
  }
}
