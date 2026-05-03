import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'packman-admin-theme'

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const readStored = (): ThemePreference => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'dark'
}

const resolve = (p: ThemePreference): ResolvedTheme => {
  if (p === 'light' || p === 'dark') return p
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const apply = (theme: ResolvedTheme) => {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStored())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readStored()))

  useEffect(() => {
    const next = resolve(preference)
    setResolved(next)
    apply(next)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next: ResolvedTheme = mql.matches ? 'dark' : 'light'
      setResolved(next)
      apply(next)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = (p: ThemePreference) => {
    try { localStorage.setItem(STORAGE_KEY, p) } catch {}
    setPreferenceState(p)
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
