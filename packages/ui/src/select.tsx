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
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  placeholder = '請選擇',
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

  const handleOpen = () => {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen((next) => !next)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        className={triggerClassName ?? 'input flex w-full items-center justify-between gap-3 text-left'}
        onClick={handleOpen}
      >
        <span className={cn(!triggerClassName && !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
        {!triggerClassName && <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />}
      </button>
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: rect.bottom + 8, left: rect.left, minWidth: Math.max(rect.width, 140), zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-black/10 bg-[#151517] p-1 shadow-2xl dark:border-white/10"
        >
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
