"use client"

import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { cn } from '@/lib/utils'

type Option = { value: string; label: ReactNode; disabled?: boolean }
type SelectionChange = { target: { value: string; name?: string; id?: string } }
type ModernSelectProps = Omit<ComponentProps<'button'>, 'onChange' | 'value' | 'defaultValue' | 'ref' | 'type'> & {
  value?: string | number
  defaultValue?: string | number
  onChange?: (event: SelectionChange) => void
  placeholder?: string
  required?: boolean
}

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return []
    if (child.type === Fragment) return readOptions(child.props.children)
    if (child.type !== 'option') return []
    return [{ value: String(child.props.value ?? child.props.children ?? ''), label: child.props.children, disabled: child.props.disabled }]
  })
}

/** Custom, keyboard-accessible selection with normal form names and empty values.
 * Existing option lists and value change handlers can migrate without changing their business logic. */
export function ModernSelect({ children, value, defaultValue, onChange, name, id, disabled, required, className, placeholder, autoFocus, form, ...props }: ModernSelectProps) {
  const options = readOptions(children)
  const emptyKey = useId()
  const [selection, setSelection] = useState<string>()
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = value !== undefined ? String(value) : selection ?? String(defaultValue ?? options[0]?.value ?? '')
  const empty = options.find(option => option.value === '')
  useEffect(() => {
    const owner = form ? document.getElementById(form) : trigger.current?.closest('form')
    const reset = () => setSelection(undefined)
    owner?.addEventListener('reset', reset)
    return () => owner?.removeEventListener('reset', reset)
  }, [form])
  return <Select name={name} value={selected} disabled={disabled} required={required} form={form} onValueChange={next => {
    const actual = next === emptyKey ? '' : next
    setSelection(actual)
    onChange?.({ target: { value: actual, name, id } })
  }}>
    <SelectTrigger ref={trigger} id={id} autoFocus={autoFocus} className={cn('modern-select w-full min-w-0 min-h-11 text-left', className)} {...props}>
      <SelectValue placeholder={empty?.label ?? placeholder ?? 'Choose an option'} />
    </SelectTrigger>
    <SelectContent collisionPadding={12} sideOffset={5}>
      {options.map(option => <SelectItem key={option.value || emptyKey} value={option.value || emptyKey} disabled={option.disabled}>{option.label}</SelectItem>)}
      {!options.length && <div className="px-3 py-4 text-sm text-muted-foreground">No options available</div>}
    </SelectContent>
  </Select>
}
