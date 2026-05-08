import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open = true,
  onClose,
  children,
}: {
  open?: boolean
  onClose?: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div
        className="card w-full max-w-sm overflow-hidden p-6"
        role="alertdialog"
        aria-modal="true"
      >
        <h3 className="break-words text-lg font-bold text-app">{title}</h3>
        {message && (
          <div className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
            {message}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Promise-based confirmation hook. Returns `confirm` (call to open and await
 * a boolean result) and `dialog` (place inside your component's JSX once).
 */
export function useConfirm() {
  type State = ConfirmOptions & { resolve: (v: boolean) => void }
  const [state, setState] = useState<State | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const finish = (result: boolean) => {
    setState((current) => {
      current?.resolve(result)
      return null
    })
  }

  const dialog = (
    <ConfirmDialog
      open={state !== null}
      title={state?.title ?? ''}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      danger={state?.danger}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  )

  return { confirm, dialog }
}
