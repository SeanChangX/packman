import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type SystemPreference = 'system'
export type LocalePreference<L extends string> = L | SystemPreference

type Messages = Record<string, string>

type Dict<L extends string> = Record<L, Messages>

type CreateOptions<L extends string> = {
  messages: Dict<L>
  defaultLocale: L
  storageKey: string
  supported: readonly L[]
}

type ProviderValue<L extends string> = {
  preference: LocalePreference<L>
  locale: L
  setPreference: (p: LocalePreference<L>) => void
  supported: readonly L[]
}

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key]
    return v === undefined || v === null ? `{${key}}` : String(v)
  })
}

const resolveSystem = <L extends string>(supported: readonly L[], defaultLocale: L): L => {
  if (typeof navigator === 'undefined') return defaultLocale
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const raw of langs) {
    if (!raw) continue
    const direct = supported.find((s) => s.toLowerCase() === raw.toLowerCase())
    if (direct) return direct
    const region = raw.split('-')[0].toLowerCase()
    const partial = supported.find((s) => s.split('-')[0].toLowerCase() === region)
    if (partial) return partial
  }
  return defaultLocale
}

export function createI18n<L extends string>(opts: CreateOptions<L>) {
  const { messages, defaultLocale, storageKey, supported } = opts

  const Context = createContext<ProviderValue<L> | null>(null)

  const readStored = (): LocalePreference<L> => {
    try {
      const v = localStorage.getItem(storageKey)
      if (v === 'system') return 'system'
      if (v && (supported as readonly string[]).includes(v)) return v as L
    } catch {}
    return 'system'
  }

  const resolve = (p: LocalePreference<L>): L => {
    if (p === 'system') return resolveSystem(supported, defaultLocale)
    return p
  }

  function LocaleProvider({ children }: { children: ReactNode }) {
    const [preference, setPreferenceState] = useState<LocalePreference<L>>(() => readStored())
    const [locale, setLocale] = useState<L>(() => resolve(readStored()))

    useEffect(() => {
      setLocale(resolve(preference))
    }, [preference])

    useEffect(() => {
      if (preference !== 'system') return
      if (typeof window === 'undefined') return
      const onChange = () => setLocale(resolve('system'))
      window.addEventListener('languagechange', onChange)
      return () => window.removeEventListener('languagechange', onChange)
    }, [preference])

    useEffect(() => {
      if (typeof document !== 'undefined') document.documentElement.lang = locale
    }, [locale])

    const setPreference = (p: LocalePreference<L>) => {
      try { localStorage.setItem(storageKey, p) } catch {}
      try {
        if (typeof document !== 'undefined') {
          const cookieValue = p === 'system' ? '' : p
          const maxAge = p === 'system' ? 0 : 60 * 60 * 24 * 365
          document.cookie = `packman-locale=${cookieValue}; path=/; max-age=${maxAge}; SameSite=Lax`
        }
      } catch {}
      setPreferenceState(p)
    }

    const value = useMemo<ProviderValue<L>>(
      () => ({ preference, locale, setPreference, supported }),
      [preference, locale],
    )

    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  function useLocale() {
    const ctx = useContext(Context)
    if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
    return ctx
  }

  function useT() {
    const { locale } = useLocale()
    return (key: string, params?: Record<string, string | number>): string => {
      const dict = messages[locale] ?? messages[defaultLocale]
      const fallback = messages[defaultLocale]
      const raw = dict[key] ?? fallback[key] ?? key
      return interpolate(raw, params)
    }
  }

  // Non-hook helpers, usable from outside React (e.g., api.ts fetch wrappers)
  const getLocale = (): L => resolve(readStored())

  const translate = (key: string, params?: Record<string, string | number>): string => {
    const locale = getLocale()
    const dict = messages[locale] ?? messages[defaultLocale]
    const fallback = messages[defaultLocale]
    const raw = dict[key] ?? fallback[key] ?? key
    return interpolate(raw, params)
  }

  return { LocaleProvider, useLocale, useT, getLocale, translate }
}
