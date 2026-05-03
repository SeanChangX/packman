import {
  Select as BaseSelect,
  SelectController as BaseSelectController,
  type SelectOption,
} from '@packman/ui'
import { useT } from './i18n'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'

export type { SelectOption }

export function Select<T extends string>({
  placeholder,
  ...rest
}: {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  placeholder?: string
  triggerClassName?: string
}) {
  const t = useT()
  return <BaseSelect {...rest} placeholder={placeholder ?? t('common.placeholder.select')} />
}

export function SelectController<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  placeholder,
  ...rest
}: {
  name: TName
  control: Control<TFieldValues>
  options: readonly SelectOption<string>[]
  className?: string
  placeholder?: string
  emptyValue?: 'undefined' | 'null'
}) {
  const t = useT()
  return <BaseSelectController {...rest} placeholder={placeholder ?? t('common.placeholder.select')} />
}
