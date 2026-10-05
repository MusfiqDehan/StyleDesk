"use client";

import { useId, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Keeps the original input's name, ref, validation and form submission behavior. */
export function SecretInput({ type = 'password', className, style, id, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const label = props['aria-label'] ?? (props.name ?? id ?? 'password')
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
  return <span className="secret-input-wrap">
    <input {...props} aria-label={label} id={inputId} type={visible ? 'text' : type} data-secret-input="true"
      className={cn('secret-input', className)} style={{ ...style, paddingInlineEnd: '2.75rem' }} />
    <button type="button" className="secret-input-toggle" disabled={props.disabled}
      aria-controls={inputId} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
      aria-pressed={visible} onClick={() => setVisible(value => !value)}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </span>;
}
