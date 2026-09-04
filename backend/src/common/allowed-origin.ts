/** Explicit browser origins shared by HTTP and Socket.IO. */
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true; // Non-browser API clients still require authentication.
  const configured = [
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGIN || '').split(','),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().replace(/\/$/, ''));
  if (process.env.NODE_ENV !== 'production') {
    configured.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    );
  }
  try {
    const parsed = new URL(origin);
    const base = process.env.TENANT_BASE_DOMAIN || 'localhost';
    const suffix = `.${base}`;
    const slug = parsed.hostname.endsWith(suffix)
      ? parsed.hostname.slice(0, -suffix.length)
      : '';
    if (
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      (parsed.protocol === 'https:' || process.env.NODE_ENV !== 'production')
    )
      return true;
  } catch {
    return false;
  }
  return configured.includes(origin);
}

let registeredHost: ((hostname: string) => Promise<boolean>) | undefined;
export function configureOriginResolver(
  resolver: (hostname: string) => Promise<boolean>,
) {
  registeredHost = resolver;
}
export async function isAllowedOriginAsync(origin?: string): Promise<boolean> {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (
      url.hostname === (process.env.PLATFORM_HOST ?? 'localhost') &&
      isAllowedOrigin(origin)
    )
      return true;
    if (!registeredHost) return isAllowedOrigin(origin);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production')
      return false;
    return !!registeredHost && (await registeredHost(url.hostname));
  } catch {
    return false;
  }
}
