import type { NextRequest } from 'next/server'
import { forwardBackendRequest } from '@/lib/backend-proxy'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return forwardBackendRequest(request, { params: Promise.resolve({ path: ['uploads', ...path] }) })
}
export { GET as HEAD }
