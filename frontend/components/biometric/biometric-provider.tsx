'use client'

/**
 * Formerly showed a global "new device user" link modal on WebSocket events.
 * That flow is disabled — admins link users only from /admin/unlinked-users.
 * Provider kept so existing layout imports keep working.
 */
export function BiometricProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
