import { headers } from 'next/headers'
import { isPlatformHostname } from '@/lib/platform-host'
import { tenantOrigin } from '@/lib/tenant-fetch'
import type { MetadataRoute } from 'next'
import { getPublicCatalog } from '@/lib/public-catalog'

export const dynamic = 'force-dynamic'

type Entry = MetadataRoute.Sitemap[number]

const TENANT_STATIC_ROUTES: Array<Pick<Entry, 'changeFrequency' | 'priority'> & { path: string }> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/services', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/packages', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/our-team', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about-us', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/register', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/llms.txt', changeFrequency: 'monthly', priority: 0.5 },
]

function lastModified(value?: string): Date {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await tenantOrigin()
  const absoluteUrl = (path = '/') => `${origin}${path}`
  const now = new Date()

  if (isPlatformHostname((await headers()).get('host') ?? '')) {
    return [
      {
        url: absoluteUrl('/'),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 1.0,
        images: [absoluteUrl('/brand/platform/og-cover.jpg')],
      },
      {
        url: absoluteUrl('/platform-ui/register'),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: absoluteUrl('/login'),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      {
        url: absoluteUrl('/llms.txt'),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      },
    ]
  }

  const visibility = await (
    await import('@/lib/tenant-fetch')
  ).tenantFetch((process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:4000') + '/access/public', {
    cache: 'no-store',
  })
  if (!visibility.ok || !(await visibility.json()).landingPage) return []

  const { services, packages, team } = await getPublicCatalog()

  return [
    ...TENANT_STATIC_ROUTES.map(({ path, ...rest }) => ({
      url: absoluteUrl(path),
      lastModified: now,
      ...rest,
      ...(path === '/' ? { images: [absoluteUrl('/brand/tenant/og-cover.jpg')] } : {}),
    })),
    ...services.map((item) => ({
      url: absoluteUrl(`/services/${item.id}`),
      lastModified: lastModified(item.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...packages.map((item) => ({
      url: absoluteUrl(`/packages/${item.id}`),
      lastModified: lastModified(item.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...team.map((item) => ({
      url: absoluteUrl(`/our-team/${item.id}`),
      lastModified: lastModified(item.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}
