import type { Metadata } from 'next'
import { AuthGuard } from '@admin/components/auth-guard'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@admin/lib/auth-utils'
import { Analytics } from '@vercel/analytics/next'
import { BiometricProvider } from '@/components/biometric/biometric-provider'
import { buildAppMetadata } from '@/lib/business-branding-server'

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await buildAppMetadata({
    titleSuffix: 'Salon Workspace',
  })
  return { ...metadata, robots: { index: false, follow: false } }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value || cookieStore.get('token')?.value
  const initialUser = token ? getUserFromToken(token) : null

  return (
    <div className="admin-shell h-dvh max-h-dvh overflow-hidden">
      <AuthGuard initialUser={initialUser}>
        <BiometricProvider>
          {children}
        </BiometricProvider>
      </AuthGuard>
      {process.env.NODE_ENV === 'production' && <Analytics />}
    </div>
  )
}
