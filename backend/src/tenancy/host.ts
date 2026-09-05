import { NotFoundException } from '@nestjs/common';
export function tenantSlug(host: string, domain = process.env.TENANT_BASE_DOMAIN ?? 'localhost'): string {
  const hostname = host.toLowerCase().split(':')[0];
  const suffix = `.${domain.toLowerCase()}`;
  if (!hostname.endsWith(suffix)) throw new NotFoundException('Unknown salon');
  const slug = hostname.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) throw new NotFoundException('Unknown salon');
  return slug;
}

export function normalizeHost(host: string): string { const value=host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, ''); if(!/^[a-z0-9.-]+$/.test(value)) throw new NotFoundException('Invalid host'); return value; }
export function isPlatformHost(host: string): boolean { return normalizeHost(host) === (process.env.PLATFORM_HOST ?? 'localhost'); }
export function tenantHostKey(host: string): string { const h=normalizeHost(host); const suffix='.'+(process.env.TENANT_BASE_DOMAIN ?? 'localhost'); if(!h.includes('.')) throw new NotFoundException('Unknown salon'); return h.endsWith(suffix) ? tenantSlug(host) : h; }
