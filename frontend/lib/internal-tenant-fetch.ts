import http from 'node:http'
import https from 'node:https'
import { Readable } from 'node:stream'

/** Node fetch normalizes Host to its destination; native HTTP preserves salon identity. */
export async function internalTenantFetch(input: string | URL | Request, options: RequestInit = {}): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid internal API protocol')
  const headers = new Headers(options.headers)
  const body = options.body
  if (body != null && typeof body !== 'string' && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) throw new Error('Unsupported internal API body')
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: options.method || 'GET', headers: Object.fromEntries(headers.entries()),
    }, incoming => {
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item)
        else if (value !== undefined) responseHeaders.set(name, value)
      }
      const status = incoming.statusCode || 502
      const noBody = options.method === 'HEAD' || [204, 205, 304].includes(status)
      if (noBody) incoming.resume()
      resolve(new Response(noBody ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>, { status, headers: responseHeaders }))
    })
    request.setTimeout(120_000, () => request.destroy(new Error('Internal API timeout')))
    request.on('error', reject)
    if (options.signal) {
      const abort = () => request.destroy(new Error('Internal API request aborted'))
      if (options.signal.aborted) abort()
      else { options.signal.addEventListener('abort', abort, { once: true }); request.once('close', () => options.signal?.removeEventListener('abort', abort)) }
    }
    request.end(body instanceof ArrayBuffer ? Buffer.from(body) : body)
  })
}
