import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'

interface ShowToastOptions {
  sticky?: boolean
  progress?: number // 0..1, omit for non-progress toast
  durationMs?: number
}

interface UpdateToastPatch {
  message?: string
  tone?: ToastTone
  progress?: number
  sticky?: boolean
}

interface Toast {
  id: number
  message: string
  tone: ToastTone
  closing?: boolean
  sticky?: boolean
  progress?: number
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone, options?: ShowToastOptions) => number
  updateToast: (id: number, patch: UpdateToastPatch) => void
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 4200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<number, number>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((current) =>
      current.map((toast) => toast.id === id ? { ...toast, closing: true } : toast)
    )
    window.setTimeout(() => removeToast(id), 180)
  }, [removeToast])

  const scheduleAutoDismiss = useCallback((id: number, durationMs: number) => {
    const existing = timersRef.current.get(id)
    if (existing) window.clearTimeout(existing)
    const timer = window.setTimeout(() => dismiss(id), durationMs)
    timersRef.current.set(id, timer)
  }, [dismiss])

  const showToast = useCallback((message: string, tone: ToastTone = 'info', options?: ShowToastOptions) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, {
      id,
      message,
      tone,
      sticky: options?.sticky,
      progress: options?.progress,
    }])
    if (!options?.sticky) {
      scheduleAutoDismiss(id, options?.durationMs ?? DEFAULT_DURATION)
    }
    return id
  }, [scheduleAutoDismiss])

  const updateToast = useCallback((id: number, patch: UpdateToastPatch) => {
    setToasts((current) => current.map((toast) => {
      if (toast.id !== id) return toast
      const next: Toast = { ...toast, ...patch }
      // If sticky was lifted in the patch, schedule auto-dismiss now.
      if (toast.sticky && patch.sticky === false) {
        scheduleAutoDismiss(id, DEFAULT_DURATION)
      }
      return next
    }))
  }, [scheduleAutoDismiss])

  const value = useMemo(() => ({ showToast, updateToast, dismissToast: dismiss }), [showToast, updateToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const pct = typeof toast.progress === 'number'
            ? Math.max(0, Math.min(1, toast.progress)) * 100
            : null
          return (
            <div
              key={toast.id}
              className={[
                'relative overflow-hidden flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl will-change-transform transition-[opacity,transform,filter] duration-180 ease-out',
                toast.closing ? 'translate-y-1 opacity-0 blur-[1px]' : 'translate-y-0 opacity-100 animate-[toast-in_180ms_cubic-bezier(0.16,1,0.3,1)]',
                toast.tone === 'error'
                  ? 'border-red-500/25 bg-red-500/15 text-red-100 shadow-red-950/20'
                  : toast.tone === 'success'
                    ? 'border-transparent bg-[#1c1c1e]/95 text-zinc-100 shadow-black/35 ring-1 ring-black/30'
                    : 'border-white/15 bg-[#151517]/92 text-white shadow-black/35',
              ].join(' ')}
            >
              {toast.tone === 'success' && (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(222,39,44,0.14)]" />
              )}
              <p className="min-w-0 flex-1">{toast.message}</p>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1 text-current opacity-70 hover:bg-white/10 hover:opacity-100"
                onClick={() => dismiss(toast.id)}
              >
                <X className="h-4 w-4" />
              </button>
              {pct !== null && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                  <div
                    className={[
                      'h-full transition-[width] duration-150 ease-out',
                      toast.tone === 'error' ? 'bg-red-400' : 'bg-brand-500',
                    ].join(' ')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
            filter: blur(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
