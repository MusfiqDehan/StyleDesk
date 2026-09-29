import type { Metadata } from 'next'
import {
  brandAssets,
  type BrandSurface,
} from '@/lib/site'

/** Fallback when business settings are not loaded yet. */
export const DEFAULT_BUSINESS_NAME = 'Your salon'

export function resolveBusinessName(name?: string | null): string {
  const trimmed = name?.trim()
  return trimmed || DEFAULT_BUSINESS_NAME
}

/** URLs rendered into HTML must be browser-reachable, never the Docker-internal API host. */
function getPublicApiBaseUrl(): string {
  return ''.replace(/\/$/, '')
}

export function resolveLogoUrl(logoUrl: string): string {
  const normalized = logoUrl.trim().replace(/\\/g, '/')
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) {
    return normalized
  }

  const base = getPublicApiBaseUrl()
  if (normalized.startsWith('/uploads/')) return `${base}${normalized}`
  if (normalized.startsWith('uploads/')) return `${base}/${normalized}`
  if (normalized.startsWith('/')) return normalized
  return `${base}/uploads/${normalized}`
}

export type BusinessInfoForMetadata = {
  businessName?: string
  logoUrl?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

export function surfaceIcons(surface: BrandSurface, logoUrl?: string | null): Metadata['icons'] {
  if (surface === 'tenant' && logoUrl) {
    const url = resolveLogoUrl(logoUrl)
    return { icon: url, shortcut: url, apple: url }
  }
  if (surface === 'tenant') {
    return { icon: '/brand/tenant/salon-icon.svg', shortcut: '/brand/tenant/salon-icon.svg', apple: '/brand/tenant/salon-icon.svg' }
  }
  const brand = brandAssets(surface)
  return {
    icon: [
      { url: brand.favicon, sizes: 'any' },
      { url: brand.mark, type: surface === 'platform' ? 'image/png' : 'image/svg+xml' },
      { url: brand.icon32, sizes: '32x32', type: 'image/png' },
      { url: brand.icon192, sizes: '192x192', type: 'image/png' },
    ],
    shortcut: brand.favicon,
    apple: { url: brand.appleTouch, sizes: '180x180' },
  }
}
