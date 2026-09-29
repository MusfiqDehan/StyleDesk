import { tenantFetch } from '@/lib/tenant-fetch'
import type { Metadata } from 'next'
import { resolveLogoUrl } from '@/lib/business-branding'
import { pageMetadata } from '@/lib/seo'

const API_BASE_URL = (
  process.env.INTERNAL_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '')

type CatalogItem = {
  name?: string
  title?: string
  description?: string | null
  image?: string | null
  imageUrl?: string | null
}

async function fetchCatalogItem(endpoint: string, id: string): Promise<CatalogItem | null> {
  try {
    const res = await tenantFetch(`${API_BASE_URL}/${endpoint}/${encodeURIComponent(id)}`, {
      next: { revalidate: 600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data ?? data
  } catch {
    return null
  }
}

/** Metadata for a service or package detail page whose body renders client-side. */
export async function catalogItemMetadata(options: {
  endpoint: string
  route: string
  id: string
  fallbackTitle: string
  fallbackDescription: string
}): Promise<Metadata> {
  const item = await fetchCatalogItem(options.endpoint, options.id)
  const name = item?.name || item?.title
  const summary = item?.description?.replace(/\s+/g, ' ').trim().slice(0, 150)
  const image = item?.imageUrl || item?.image
  return pageMetadata({
    title: name || options.fallbackTitle,
    path: `/${options.route}/${options.id}`,
    description: summary ? `${summary} — book online.` : options.fallbackDescription,
    noindex: !name,
    ...(image && name ? { image: { url: resolveLogoUrl(image), alt: name } } : {}),
  })
}
