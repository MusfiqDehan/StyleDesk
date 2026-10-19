import type { MetadataRoute } from 'next'
import { PLATFORM_BRAND, TENANT_BRAND, THEME_COLOR } from '@/lib/site'
import { headers } from 'next/headers'
import { isPlatformHostname } from '@/lib/platform-host'
import { fetchBusinessInfoForMetadata } from '@/lib/business-branding-server'
import { resolveBusinessName, resolveLogoUrl } from '@/lib/business-branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const platform = isPlatformHostname((await headers()).get('host') ?? '')
  const info = platform ? null : await fetchBusinessInfoForMetadata()
  const name = platform ? PLATFORM_BRAND.name : resolveBusinessName(info?.businessName)
  const icon = platform ? PLATFORM_BRAND.mark : info?.logoUrl ? resolveLogoUrl(info.logoUrl) : '/brand/tenant/salon-icon.svg'
  return {
    name,
    short_name: name,
    description: platform ? PLATFORM_BRAND.description : TENANT_BRAND.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf8fd',
    theme_color: THEME_COLOR,
    categories: ['beauty', 'lifestyle', 'business'],
    icons: [
      { src: icon, sizes: 'any', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Book an appointment', url: '/services' },
      { name: 'Packages', url: '/packages' },
      { name: 'My appointments', url: '/customer-dashboard' },
    ],
  }
}
