'use client'

import hotToast, { type ToastOptions } from 'react-hot-toast'

const lightStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#111111',
  border: '1px solid #e7e7e7',
  boxShadow: '0 10px 25px -8px rgba(15, 23, 42, 0.15)',
  fontSize: '14px',
  maxWidth: '420px',
}

function withDefaults(opts?: ToastOptions): ToastOptions {
  return {
    duration: 4000,
    ...opts,
    style: { ...lightStyle, ...opts?.style },
  }
}

/** Light-mode toast API (react-hot-toast) with sonner-compatible helpers. */
export const toast = Object.assign(
  (message: string, opts?: ToastOptions) => hotToast(message, withDefaults(opts)),
  {
    success: (message: string, opts?: ToastOptions) =>
      hotToast.success(
        message,
        withDefaults({
          iconTheme: { primary: '#7040c1', secondary: '#ffffff' },
          ...opts,
        }),
      ),
    error: (message: string, opts?: ToastOptions) =>
      hotToast.error(
        message,
        withDefaults({
          iconTheme: { primary: '#e11d48', secondary: '#ffffff' },
          ...opts,
        }),
      ),
    loading: (message: string, opts?: ToastOptions) =>
      hotToast.loading(message, withDefaults(opts)),
    message: (message: string, opts?: ToastOptions) =>
      hotToast(message, withDefaults(opts)),
    info: (message: string, opts?: ToastOptions) =>
      hotToast(message, withDefaults(opts)),
    warning: (message: string, opts?: ToastOptions) =>
      hotToast(message, withDefaults({ icon: '⚠️', ...opts })),
    custom: hotToast.custom.bind(hotToast) as typeof hotToast.custom,
    dismiss: hotToast.dismiss.bind(hotToast),
    remove: hotToast.remove.bind(hotToast),
    promise: hotToast.promise.bind(hotToast),
  },
)

export { Toaster } from 'react-hot-toast'
