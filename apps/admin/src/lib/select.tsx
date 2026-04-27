import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className = '',
  placeholder = '請選擇',
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !dropdownRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const handleOpen = () => {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen((next) => !next)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className="input flex items-center justify-between gap-3 text-left"
        onClick={handleOpen}
      >
        <span className={!selected ? 'text-muted' : ''}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: rect.bottom + 8, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-black/10 bg-[#151517] p-1 shadow-2xl dark:border-white/10"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10 ${option.value === value ? 'bg-brand-500' : ''}`}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
