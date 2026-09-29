import 'server-only'
import { cache } from 'react'
import type { Metadata } from 'next'
import { PLATFORM_BRAND, TENANT_BRAND, type BrandSurface } from '@/lib/site'
import { tenantOrigin, tenantFetch } from '@/lib/tenant-fetch'
import { resolveBusinessName, surfaceIcons, type BusinessInfoForMetadata } from '@/lib/business-branding'
function getApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ||
    'http://localhost:4000'
  ).replace(/\/$/, '')
}

// Deduplicate nested metadata reads within one render; never cache across tenants.
export const fetchBusinessInfoForMetadata = cache(async (): Promise<BusinessInfoForMetadata | null> => {
  try {
    const res = await tenantFetch(`${getApiBaseUrl()}/bussiness-info`, {
      next: { revalidate: 600 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
})

export async function buildAppMetadata(options?: {
  titleSuffix?: string
  description?: string
  surface?: BrandSurface
}): Promise<Metadata> {
  const surface = options?.surface ?? 'tenant'
  const info = await fetchBusinessInfoForMetadata()
  const name = resolveBusinessName(info?.businessName)
  const brand = surface === 'platform' ? PLATFORM_BRAND : TENANT_BRAND
  const defaultTitle = options?.titleSuffix
    ? `${name} — ${options.titleSuffix}`
    : `${name} — ${brand.tagline} | Book online`
  const description = options?.description ?? brand.description

  return {
    metadataBase: new URL(await tenantOrigin()),
    title: { default: defaultTitle, template: `%s | ${name}` },
    description,
    applicationName: name,
    keywords: [...brand.keywords],
    authors: [PLATFORM_BRAND.author],
    creator: PLATFORM_BRAND.author.name,
    publisher: name,
    category: surface === 'platform' ? 'business software' : 'beauty',
    alternates: { canonical: '/' },
    manifest: '/manifest.webmanifest',
    icons: surfaceIcons(surface, info?.logoUrl),
    formatDetection: { telephone: false, address: false, email: false },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: '/',
      siteName: name,
      title: defaultTitle,
      description,
      images: [{ url: brand.cover, width: 1200, height: 630, alt: brand.coverAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
      images: [{ url: brand.cover, alt: brand.coverAlt }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  }
}
