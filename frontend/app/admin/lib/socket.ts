import type { ManagerOptions, SocketOptions } from "socket.io-client"

/**
 * Resolve Socket.IO URL + options for local vs production.
 *
 * Production API is behind Traefik at `https://domain/api` (prefix stripped
 * before Nest). Passing that full URL to `io()` makes Socket.IO treat `/api`
 * as a *namespace* and still hit `/socket.io` on the site origin — which goes
 * to Next.js, not the API. So real-time bookings work on localhost:4000 but
 * silently fail on the live site.
 *
 * Correct production connect: origin + `path: "/api/socket.io"`.
 */
export function getSocketConnection(): {
  url: string
  options: Partial<ManagerOptions & SocketOptions>
} {
  const local = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production'
  const raw = typeof window !== 'undefined'
    ? local ? `${location.protocol}//${location.hostname}:4000` : `${location.origin}/api`
    : 'http://localhost:4000'
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`

  let origin = withProtocol
  let apiPrefix = ""
  try {
    const parsed = new URL(withProtocol)
    origin = parsed.origin
    apiPrefix = parsed.pathname.replace(/\/$/, "")
  } catch {
    origin = withProtocol.replace(/\/$/, "")
  }

  const path =
    apiPrefix && apiPrefix !== "/"
      ? `${apiPrefix}/socket.io`
      : "/socket.io"

  return {
    url: origin,
    options: {
      path,
      auth: typeof document !== 'undefined' ? { branchId: document.cookie.split('; ').find(value => value.startsWith('branchId='))?.slice(9) } : {},
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
    },
  }
}
