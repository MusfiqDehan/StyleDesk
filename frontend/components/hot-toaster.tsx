'use client'

import { Toaster } from 'react-hot-toast'

const lightStyle = {
  background: '#ffffff',
  color: '#111111',
  border: '1px solid #e7e7e7',
  boxShadow: '0 10px 25px -8px rgba(15, 23, 42, 0.15)',
  fontSize: '14px',
  maxWidth: '420px',
} as const

/** Single light-mode toaster for the whole app. */
export function HotToaster() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={10}
      toastOptions={{
        duration: 4000,
        style: lightStyle,
        success: {
          iconTheme: { primary: '#7040c1', secondary: '#ffffff' },
        },
        error: {
          iconTheme: { primary: '#e11d48', secondary: '#ffffff' },
        },
      }}
    />
  )
}
