import { headers } from 'next/headers'
import { isPlatformHostname } from '@/lib/platform-host'
import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import { ClientProviders } from './client-providers'
import { buildAppMetadata } from '@/lib/business-branding-server'
import { surfaceIcons } from '@/lib/business-branding'
import { PLATFORM_BRAND, THEME_COLOR } from '@/lib/site'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "600", "700"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host') ?? ''
  if (isPlatformHostname(host)) {
    const brand = PLATFORM_BRAND
    return {
      title: {
        default: 'StyleDesk — All-in-One Salon & Spa Management Platform',
        template: '%s | StyleDesk',
      },
      description: brand.description,
      keywords: brand.keywords,
      authors: [brand.author],
      creator: brand.author.name,
      publisher: 'StyleDesk',
      metadataBase: new URL(process.env.PLATFORM_PUBLIC_URL ?? 'https://styledesk.musfiqdehan.com'),
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://styledesk.musfiqdehan.com',
        siteName: 'StyleDesk',
        title: 'StyleDesk — All-in-One Salon & Spa Management Platform',
        description: brand.description,
        images: [
          {
            url: brand.cover,
            width: 1200,
            height: 630,
            alt: brand.coverAlt,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'StyleDesk — All-in-One Salon & Spa Management Platform',
        description: brand.description,
        images: [{ url: brand.cover, alt: brand.coverAlt }],
      },
      icons: surfaceIcons('platform'),
      robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
      },
    }
  }
  return buildAppMetadata()
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: 'light dark',
}

/** Runs before paint so first frame already matches window width */
const viewportFitBootScript = `
(function () {
  try {
    var DESIGN = 1440;
    var MOBILE = 1023;
    var MIN = 0.82;
    var MAX = 1.12;
    var path = location.pathname || '';
    var publicPages = ['/services', '/packages', '/our-team', '/about-us', '/contact', '/customer-dashboard', '/account-settings'];
    var noScale = path === '/' || publicPages.some(function (p) {
      return path === p || path.indexOf(p + '/') === 0;
    }) || ['/login','/register','/forgot-password','/reset-password'].some(function (p) {
      return path === p || path.indexOf(p + '/') === 0;
    });
    var w = window.innerWidth || DESIGN;
    var scale = noScale ? 1 : (w <= MOBILE ? 1 : Math.min(MAX, Math.max(MIN, w / DESIGN)));
    var root = document.documentElement;
    root.style.setProperty('--app-scale', String(scale));
    root.style.zoom = String(scale);
    root.setAttribute('data-app-scale', scale.toFixed(3));
  } catch (e) {}
})();
`

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const platform=isPlatformHostname((await headers()).get('host')??'')
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {!platform && <script dangerouslySetInnerHTML={{ __html: viewportFitBootScript }} />}
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <ClientProviders platform={platform}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
