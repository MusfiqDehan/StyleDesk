export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://styledesk.musfiqdehan.com').replace(/\/$/, '')

export const THEME_COLOR = '#7040c1'

export type BrandSurface = 'tenant' | 'platform'

type BrandAssets = {
  logo: string
  mark: string
  cover: string
  coverAlt: string
  favicon: string
  icon32: string
  icon192: string
  icon512: string
  appleTouch: string
}

function assets(surface: BrandSurface, coverAlt: string): BrandAssets {
  const base = `/brand/${surface}`
  return {
    logo: `${base}/logo.svg`,
    mark: `${base}/logo-mark.svg`,
    cover: `${base}/og-cover.jpg`,
    coverAlt,
    favicon: `${base}/favicon.ico`,
    icon32: `${base}/favicon-32.png`,
    icon192: `${base}/icon-192.png`,
    icon512: `${base}/icon-512.png`,
    appleTouch: `${base}/apple-touch-icon.png`,
  }
}

/** The salon storefront visitors book from (`/`, services, packages, people…). */
export const TENANT_BRAND = {
  tagline: 'Hair, beauty & barbering salon',
  description:
    'Hair, beauty, and barbering in one happy place. Explore services and packages, choose your stylist, and book your next salon appointment online in minutes.',
  keywords: [
    'hair salon',
    'beauty salon',
    'barber shop',
    'book salon appointment online',
    'haircut',
    'hair color',
    'blowout',
    'facial',
    'makeup',
    'beard trim',
    'salon packages',
    'stylist',
  ],
  ...assets('tenant', 'A little glow, a fresh look, all you. Book online.'),
  cover: '/brand/tenant/og-cover.jpg',
  icon512: '/brand/tenant/salon-icon.svg',
}

/** The StyleDesk product itself: sign-in, workspace, and API docs. */
export const PLATFORM_BRAND = {
  name: 'StyleDesk',
  tagline: 'All-in-One Salon & Spa Management Platform',
  description:
    'StyleDesk is an all-in-one multi-tenant salon management platform: online booking, appointments, POS and invoicing, staff attendance and payroll, inventory, finance, and reports in one workspace.',
  keywords: [
    'salon management software',
    'salon booking system',
    'salon POS',
    'appointment scheduling',
    'staff attendance',
    'payroll',
    'inventory management',
    'beauty business software',
    'barbershop software',
    'spa management system',
  ],
  author: { name: 'MusfiqDehan', url: 'https://musfiqdehan.com' },
  ...assets('platform', 'StyleDesk — Run your salon from one desk. Bookings, POS, staff, and reports.'),
  cover: '/brand/platform/og-cover.jpg',
  logo: '/brand/platform/styledesk-modern.png',
  mark: '/brand/platform/styledesk-modern.png',
  favicon: '/brand/platform/styledesk-modern.png',
  icon32: '/brand/platform/styledesk-modern.png',
  icon192: '/brand/platform/styledesk-modern.png',
  icon512: '/brand/platform/styledesk-modern.png',
  appleTouch: '/brand/platform/styledesk-modern.png',
}

export function brandAssets(surface: BrandSurface): BrandAssets {
  return surface === 'platform' ? PLATFORM_BRAND : TENANT_BRAND
}

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
