import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from './utils'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  placeholder = '請選擇',
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        className="input flex items-center justify-between gap-3 text-left"
        onClick={() => setOpen((next) => !next)}
      >
        <span className={cn(!selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-black/10 bg-[#151517] p-1 shadow-2xl dark:border-white/10">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10',
                option.value === value && 'bg-brand-500'
              )}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
