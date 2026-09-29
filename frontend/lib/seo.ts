import type { Metadata } from 'next'
import { resolveBusinessName, surfaceIcons } from '@/lib/business-branding'
import { fetchBusinessInfoForMetadata } from '@/lib/business-branding-server'
import { brandAssets, type BrandSurface } from '@/lib/site'
import { headers } from 'next/headers'
import { isPlatformHostname } from '@/lib/platform-host'

type PageSeo = {
  title: string
  description: string
  path: string
  surface?: BrandSurface
  noindex?: boolean
  image?: { url: string; alt: string }
}

/**
 * Child `openGraph`/`twitter` objects replace the root ones wholesale, so every page
 * re-declares its cover and canonical URL instead of relying on layout inheritance.
 */
export async function pageMetadata({
  title,
  description,
  path,
  surface,
  noindex = false,
  image,
}: PageSeo): Promise<Metadata> {
  // Shared routes choose their brand from the request host, including auth/admin.
  surface = isPlatformHostname((await headers()).get('host') ?? '') ? 'platform' : 'tenant'
  const info = surface === 'tenant' ? await fetchBusinessInfoForMetadata() : null
  const name = surface === 'platform' ? 'StyleDesk' : resolveBusinessName(info?.businessName)
  const brand = brandAssets(surface)
  const cover = image ?? { url: brand.cover, alt: brand.coverAlt }
  const fullTitle = `${title} | ${name}`

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      siteName: name,
      title: fullTitle,
      description,
      images: [{ url: cover.url, width: 1200, height: 630, alt: cover.alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [cover],
    },
    icons: surfaceIcons(surface, info?.logoUrl),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
