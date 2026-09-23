import { isPlatformHostname } from '@/lib/platform-host'
import { internalTenantFetch } from '@/lib/internal-tenant-fetch'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * In-memory cache for the proxy (per Node process). Kept short — an admin toggling
 * "Hide Main Website" in Settings expects the effect (e.g. the sidebar logo link
 * going to the public site) to apply almost immediately, not up to 2 minutes later.
 */
const visibilityCache = new Map<string, { hideMainWebsite: boolean; fetchedAt: number }>()
const VISIBILITY_TTL_MS = 5_000

function apiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ||
    'http://127.0.0.1:4000'
  ).replace(/\/$/, '')
}

async function isMainWebsiteHidden(host: string): Promise<boolean> {
  const now = Date.now()
  const cached = visibilityCache.get(host)
  if (cached && now - cached.fetchedAt < VISIBILITY_TTL_MS) {
    return cached.hideMainWebsite
  }

  try {
    const res = await internalTenantFetch(`${apiBaseUrl()}/bussiness-info/site-visibility`, {
      method: 'GET',
      headers: { Accept: 'application/json', host },
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error('Salon unavailable')
    }
    const visibility = await internalTenantFetch(`${apiBaseUrl()}/access/public`,{headers:{host},cache:'no-store'})
    if(!visibility.ok) throw new Error('Salon unavailable')
    const access = await visibility.json() as {landingPage:boolean}
    const data = (await res.json()) as { hideMainWebsite?: boolean }
    const hideMainWebsite = Boolean(data?.hideMainWebsite) || !access.landingPage
    visibilityCache.set(host, { hideMainWebsite, fetchedAt: now })
    return hideMainWebsite
  } catch {
    // Prefer last known value; default to public site if never fetched.
    throw new Error('Salon unavailable')
  }
}

function isStaticOrApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    // Public product-tour assets include MP4 media and WebVTT captions.
    pathname.startsWith('/marketing/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/llms.txt' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.(?:png|svg|jpg|jpeg|webp|ico|avif|gif|woff2?|css|js|map|txt|xml)$/i.test(pathname)
  )
}

/** Auth / recovery routes that stay public even when the marketing site is hidden. */
function isAuthPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/') ||
    ['/register','/reset-password','/accept-invitation','/payment-result','/customer-dashboard','/account-settings','/billing','/pay-invoice'].some(p=>pathname===p||pathname.startsWith(p+'/'))
  )
}

export default async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const path = request.nextUrl.pathname

  if (isPlatformHostname(host)) {
    if (isStaticOrApiPath(path) || ['/robots.txt', '/sitemap.xml', '/llms.txt', '/accept-invitation', '/payment-result'].includes(path)) {
      return NextResponse.next()
    }

    const hasPlatformToken = Boolean(request.cookies.get('platformToken')?.value)

    if (path === '/platform-ui' || path === '/platform-ui/' || path.startsWith('/platform-ui/')) {
      if (path.startsWith('/platform-ui/admin')) {
        if (!hasPlatformToken) {
          const loginUrl = request.nextUrl.clone()
          loginUrl.pathname = '/login'
          loginUrl.search = `next=${encodeURIComponent(path)}`
          return NextResponse.redirect(loginUrl)
        }
      }
      return NextResponse.next()
    }

    if (path === '/login' || path === '/register' || path === '/' || path === '/admin' || path.startsWith('/admin/')) {
      if (path === '/login' && hasPlatformToken) {
        return NextResponse.redirect(new URL('/platform-ui/admin', request.url))
      }
      if (path === '/admin' || path.startsWith('/admin/')) {
        if (!hasPlatformToken) {
          const loginUrl = request.nextUrl.clone()
          loginUrl.pathname = '/login'
          loginUrl.search = `next=${encodeURIComponent(path)}`
          return NextResponse.redirect(loginUrl)
        }
      }
      const url = request.nextUrl.clone()
      url.pathname = '/platform-ui' + (path === '/' ? '' : path)
      return NextResponse.rewrite(url)
    }

    return new NextResponse('Not Found', { status: 404 })
  }

  // Tenant hostnames: explicitly forbid accessing platform UI
  if (path.startsWith('/platform-ui')) {
    return new NextResponse('Not Found', { status: 404 })
  }
  const token = request.cookies.get('accessToken')?.value
  const { pathname } = request.nextUrl
  if (pathname === '/admin/ai-knowledge' || pathname.startsWith('/admin/ai-knowledge/')) return new NextResponse('Not Found', { status: 404 })

  if (isStaticOrApiPath(pathname)) {
    return NextResponse.next()
  }

  let hideMainWebsite: boolean
  try { hideMainWebsite = await isMainWebsiteHidden(request.headers.get('host') || '') }
  catch { return new NextResponse('Salon unavailable', { status: 404 }) }

  // ── Admin panel (always reachable) ──────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/dashboard') {
      const adminUrl = request.nextUrl.clone()
      adminUrl.pathname = '/admin'
      return NextResponse.redirect(adminUrl)
    }

    // /admin/login is a legacy stub — always send to /login or dashboard
    if (pathname === '/admin/login') {
      const target = request.nextUrl.clone()
      target.pathname = token ? '/admin' : '/login'
      target.search = token ? '' : 'next=%2Fadmin'
      return NextResponse.redirect(target)
    }

    if (!token) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  // ── Public site visibility ──────────────────────────────────────────────


  if (!hideMainWebsite) {
    return NextResponse.next()
  }

  if (isAuthPublicPath(pathname)) {
    // Identity routes remain usable when the marketing website is hidden.
    return NextResponse.next()
  }

  // Everything else on the public site → administration login
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|avif|gif|woff2?)).*)',
  ],
}
