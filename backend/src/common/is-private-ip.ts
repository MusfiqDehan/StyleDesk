/**
 * Returns true for loopback and RFC1918 / link-local IPv4 addresses.
 * Used to block SSRF via device-config overrides and to restrict iClock clients.
 */
export function normalizeIp(raw: string | undefined | null): string {
  if (!raw) return '';
  let ip = String(raw).trim();
  // Take first hop if X-Forwarded-For style
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

export function isPrivateOrLoopbackIp(raw: string | undefined | null): boolean {
  const ip = normalizeIp(raw);
  if (!ip) return false;
  if (ip === '127.0.0.1') return true;

  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 link-local
  if (a === 169 && b === 254) return true;

  return false;
}

export function clientIpFromRequest(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  // Prefer socket / Express req.ip when not behind a trusted proxy chain for security.
  // If TRUST_PROXY=true, honor X-Forwarded-For first.
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  if (trustProxy && forwardedValue) {
    return normalizeIp(forwardedValue);
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}
