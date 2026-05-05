import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export interface SelectOption<T extends string> {
  value: T
  label: string
  hint?: string
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  placeholder = '',
  triggerClassName,
}: {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  placeholder?: string
  triggerClassName?: string
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

  useEffect(() => {
    if (!open) return
    const updateRect = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open])

  const handleOpen = () => {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen((next) => !next)
  }

  const GAP = 8
  const MARGIN = 16
  const spaceBelow = rect ? window.innerHeight - rect.bottom - MARGIN : 0
  const spaceAbove = rect ? rect.top - MARGIN : 0
  const placeAbove = !!rect && spaceBelow < 200 && spaceAbove > spaceBelow
  const maxHeight = placeAbove ? spaceAbove - GAP : spaceBelow - GAP
  const PREFERRED_MIN = 180
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0
  const spaceRight = rect ? viewportW - rect.left - MARGIN : 0
  const spaceLeftOfRight = rect ? rect.right - MARGIN : 0
  const anchorRight = !!rect && spaceRight < PREFERRED_MIN && spaceLeftOfRight > spaceRight
  const maxAvailableW = anchorRight ? spaceLeftOfRight : spaceRight
  const minWidth = rect ? Math.min(Math.max(rect.width, 140), Math.max(viewportW - 2 * MARGIN, 0)) : 0
  const maxWidth = Math.max(minWidth, Math.min(maxAvailableW, 400))

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        className={triggerClassName ?? 'input flex w-full min-w-0 items-center justify-between gap-3 text-left'}
        onClick={handleOpen}
      >
        <span className={cn('min-w-0 flex-1 truncate whitespace-nowrap', !triggerClassName && !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
        {!triggerClassName && <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />}
      </button>
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: placeAbove ? undefined : rect.bottom + GAP,
            bottom: placeAbove ? window.innerHeight - rect.top + GAP : undefined,
            left: anchorRight ? undefined : rect.left,
            right: anchorRight ? viewportW - rect.right : undefined,
            minWidth,
            maxWidth,
            maxHeight,
            zIndex: 60,
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
          }}
          className="overflow-y-auto rounded-2xl border border-black/10 bg-[#151517] p-1 shadow-2xl dark:border-white/10"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10',
                option.value === value && 'bg-brand-500'
              )}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.hint && (
                  <span className={cn('mt-0.5 block truncate text-xs font-normal', option.value === value ? 'text-white/80' : 'text-muted')}>
                    {option.hint}
                  </span>
                )}
              </span>
              {option.value === value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

export function SelectController<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  name,
  control,
  options,
  className,
  placeholder,
  emptyValue = 'undefined',
}: {
  name: TName
  control: Control<TFieldValues>
  options: readonly SelectOption<string>[]
  className?: string
  placeholder?: string
  emptyValue?: 'undefined' | 'null'
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={(field.value ?? '') as string}
          onChange={(v) => field.onChange(v === '' ? (emptyValue === 'null' ? null : undefined) : v)}
          options={options}
          className={className}
          placeholder={placeholder}
        />
      )}
    />
  )
}
