import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizeAmount(value: number | string | null | undefined) {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function formatMoney(value: number | string | null | undefined, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(normalizeAmount(value))
}

export function formatCurrency(value: number | string | null | undefined, symbol = '৳') {
  return `${symbol}${formatMoney(value)}`
}

export function getMediaUrl(image?: string | null) {
  if (!image) return undefined;

  const normalized = image.trim().replace(/\\/g, '/');
  if (!normalized) return undefined;

  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) {
    return normalized;
  }

  const baseUrl = ('').replace(/\/$/, '');

  // Handle legacy values like "/uploads/file.webp" or "uploads/file.webp".
  if (normalized.startsWith('/uploads/')) return `${baseUrl}${normalized}`;
  if (normalized.startsWith('uploads/')) return `${baseUrl}/${normalized}`;

  // Keep local public assets untouched (e.g. "/login-cover.avif").
  if (normalized.startsWith('/')) return normalized;

  // Default: DB stores only filename (e.g. "uuid.webp").
  return `${baseUrl}/uploads/${normalized}`;
}
