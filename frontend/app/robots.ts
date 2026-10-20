import type { MetadataRoute } from 'next'
import { tenantOrigin } from '@/lib/tenant-fetch'
export const dynamic = 'force-dynamic'

const PRIVATE_PATHS = [
  '/admin',
  '/admin/',
  '/api/',
  '/platform-ui/admin',
  '/billing',
  '/pay-invoice',
  '/payment-result',
  '/accept-invitation',
  '/customer-dashboard',
  '/account-settings',
  '/register/verify-otp',
  '/forgot-password',
]

export default async function robots(): Promise<MetadataRoute.Robots> {
  const SITE_URL = await tenantOrigin()
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/llms.txt', '/services', '/packages', '/our-team', '/contact', '/about-us'],
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
