import { internalTenantFetch } from '@/lib/internal-tenant-fetch'
import type { NextRequest } from 'next/server'
export async function forwardBackendRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  if (path.some(part => part === '..' || part === '.' || part.includes('/') || part.includes('\\'))) return new Response('Invalid path', { status: 400 })
  const base = (process.env.INTERNAL_API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '')
  const headers = new Headers()
  for (const name of ['content-type', 'authorization', 'cookie', 'x-branch-id', 'x-all-branches', 'x-device-id', 'stripe-signature']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('host', request.headers.get('host') || '')
  const branch = request.cookies.get('branchId')?.value
  if (branch && !headers.has('x-branch-id')) headers.set('x-branch-id', branch)
  try {
    const upstream = await internalTenantFetch(`${base}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`, {
      method: request.method, headers, cache: 'no-store', redirect: 'manual',
      ...(!['GET','HEAD'].includes(request.method) ? { body: await request.arrayBuffer() } : {}),
    })
    const output = new Headers()
    for (const name of ['content-type', 'content-disposition', 'location']) {
      const value = upstream.headers.get(name); if (value) output.set(name, value)
    }
    for (const cookie of upstream.headers.getSetCookie()) output.append('set-cookie', cookie)
    output.set('cache-control', 'no-store')
    return new Response(upstream.body, { status: upstream.status, headers: output })
  } catch { return Response.json({ message: 'API unavailable' }, { status: 502 }) }
}
