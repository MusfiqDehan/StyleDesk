'use client'

import dynamic from 'next/dynamic'
import { ThemeProvider } from 'next-themes'
import { BookingProvider } from '@/context/BookingContext'
import { CartProvider } from '@/context/CartContext'
import { BusinessProvider } from '@/context/BusinessContext'
import { ViewportFit } from '@/components/viewport-fit'
import { ScrollToTop } from '@/components/scroll-to-top'

const BookingModal = dynamic(
  () => import('@/components/booking-modal').then(m => ({ default: m.BookingModal })),
  { ssr: false }
)
const CartDrawer = dynamic(
  () => import('@/components/cart-drawer').then(m => ({ default: m.CartDrawer })),
  { ssr: false }
)
const CartFloatingButton = dynamic(
  () => import('@/components/cart-drawer').then(m => ({ default: m.CartFloatingButton })),
  { ssr: false }
)
const HotToaster = dynamic(
  () => import('@/components/hot-toaster').then(m => ({ default: m.HotToaster })),
  { ssr: false }
)

export function ClientProviders({ children, platform=false }: { children: React.ReactNode, platform?: boolean }) {
  if(platform) return <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}<HotToaster /></ThemeProvider>
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <ViewportFit>
      <BusinessProvider>
        <CartProvider>
          <BookingProvider>
            <ScrollToTop />
            {children}
            <BookingModal />
            <CartDrawer />
            <CartFloatingButton />
            <HotToaster />
          </BookingProvider>
        </CartProvider>
      </BusinessProvider>
    </ViewportFit>
    </ThemeProvider>
  )
}
