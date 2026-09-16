import { BadRequestException } from '@nestjs/common';
export function required(v: unknown, name: string, max = 200): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new BadRequestException(`Invalid ${name}`);
  return v.trim();
}
export function email(v: unknown): string {
  const s = required(v, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new BadRequestException('Invalid email');
  return s;
}
export function password(v: unknown): string {
  const s = required(v, 'password', 128);
  if (s.length < 12)
    throw new BadRequestException('Password requires at least 12 characters');
  return s;
}
export function uuid(v: unknown): string {
  const s = required(v, 'id', 36);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s)
  )
    throw new BadRequestException('Invalid ID');
  return s;
}
export function integer(v: unknown, min = 0, max = 2147483647): number {
  if (!Number.isInteger(v) || Number(v) < min || Number(v) > max)
    throw new BadRequestException('Invalid integer');
  return Number(v);
}
export function list(v: unknown, allowed: string[]): string[] {
  if (
    !Array.isArray(v) ||
    v.some((k) => typeof k !== 'string' || !allowed.includes(k))
  )
    throw new BadRequestException('Unknown permission or feature');
  return [...new Set(v)];
}
