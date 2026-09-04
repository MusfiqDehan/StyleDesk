import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

export const CURSOR_PAGE_SIZE = 10;
export type CursorPageInfo = { pageSize: number; page: number; total: number; from: number; to: number; hasNextPage: boolean; hasPreviousPage: boolean; nextCursor: string | null; previousCursor: string | null };
type Anchor = { value: string | number | null; key: string };
type Token = { v: 1; scope: string; anchor: Anchor; direction: 'next' | 'previous'; page: number; expires: number };
export type CursorFilter = { field: string; op: 'eq' | 'in' | 'gte' | 'lte' | 'contains'; value: unknown };
export type CursorRequest = { scope: string; path: string; cursor: Token | null; sort?: string; order: 'asc' | 'desc'; search: string; filters: CursorFilter[]; pageInfo?: CursorPageInfo };
export const cursorStorage = new AsyncLocalStorage<CursorRequest>();
export const cursorRequest = () => cursorStorage.getStore();
function secret() { const value = process.env.JWT_SECRET; if (!value) throw new Error('JWT_SECRET is required for cursor signing'); return value; }
export function cursorScope(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function encode(token: Token) { const body = Buffer.from(JSON.stringify(token)).toString('base64url'); return `${body}.${createHmac('sha256', secret()).update(`cursor:${body}`).digest('base64url')}`; }
export function decodeCursor(value: string | undefined, scope: string): Token | null {
  if (!value || value === 'start') return null;
  try {
    if (value.length > 2048) throw new Error();
    const [body, signature, extra] = value.split('.');
    const expected = createHmac('sha256', secret()).update(`cursor:${body}`).digest();
    const actual = Buffer.from(signature ?? '', 'base64url');
    if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const token: Token = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (token.v !== 1 || token.scope !== scope || !Number.isFinite(token.expires) || token.expires < Date.now() || !['next','previous'].includes(token.direction) || !Number.isInteger(token.page) || token.page < 1 || typeof token.anchor?.key !== 'string' || !['string','number','object'].includes(typeof token.anchor.value) || (typeof token.anchor.value === 'object' && token.anchor.value !== null)) throw new Error();
    return token;
  } catch { throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'This cursor is invalid, expired, or belongs to a different table or filter. Start from the first page.' }); }
}
export function fieldValue(row: unknown, path: string): unknown {
  return path.split('.').reduce((value: any, field) => value == null ? undefined : value[field], row);
}
export function normalizeValue(value: unknown): string | number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return value;
  return String(value);
}
export function compareValue(a: string | number | null, b: string | number | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  return String(a) < String(b) ? -1 : 1;
}
export function rowKey(row: any): string {
  return String(row.id ?? row.employeeId ?? row.employee_id ?? row.email ?? row.key ?? row.serial ?? cursorScope(row));
}
export function matchesFilters(row: unknown, filters: CursorFilter[]) {
  return filters.every(filter => {
    const value = fieldValue(row, filter.field);
    const expected = filter.value;
    if (filter.op === 'eq') return String(value ?? '').toLowerCase() === String(expected ?? '').toLowerCase();
    if (filter.op === 'in') return Array.isArray(expected) && expected.some(item => String(item).toLowerCase() === String(value ?? '').toLowerCase());
    if (filter.op === 'contains') return String(value ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    const a = typeof expected === 'number' ? Number(value) : normalizeValue(value), b = normalizeValue(expected);
    if (a === null || b === null) return false;
    return filter.op === 'gte' ? compareValue(a, b) >= 0 : compareValue(a, b) <= 0;
  });
}
export function makePageInfo(rows: any[], total: number, previous: boolean, next: boolean, from: number, request: CursorRequest, sort: string): CursorPageInfo {
  const page = request.cursor?.page ?? 1;
  from = rows.length ? Math.max(1, Math.min(from, total - rows.length + 1)) : 0;
  const token = (row: any, direction: Token['direction'], target: number) => encode({ v: 1, scope: request.scope, anchor: { value: normalizeValue(fieldValue(row, sort)), key: rowKey(row) }, direction, page: target, expires: Date.now() + 60 * 60 * 1000 });
  return { pageSize: CURSOR_PAGE_SIZE, page, total, from: rows.length ? from : 0, to: rows.length ? from + rows.length - 1 : 0, hasPreviousPage: previous, hasNextPage: next, previousCursor: previous && rows.length ? token(rows[0], 'previous', Math.max(1,page - 1)) : null, nextCursor: next && rows.length ? token(rows[rows.length - 1], 'next', page + 1) : null };
}
/** Keyset pagination for computed/report rows. Filters and sorting precede the cursor boundary. */
export function paginateRows<T>(input: T[], request: CursorRequest) {
  let rows = input.filter(row => matchesFilters(row, request.filters));
  if (request.search) rows = rows.filter(row => JSON.stringify(row, (key,value) => key==='metrics' ? undefined : value).toLowerCase().includes(request.search.toLowerCase()));
  const sample: any = rows[0];
  const sort = request.sort ?? (sample?.createdAt != null ? 'createdAt' : sample?.created_at != null ? 'created_at' : 'id');
  const direction = request.order === 'asc' ? 1 : -1;
  const anchor = (row: T): Anchor => ({ value: normalizeValue(fieldValue(row, sort)), key: rowKey(row) });
  const compare = (a: Anchor, b: Anchor) => { const value = compareValue(a.value,b.value); return value ? (a.value === null || b.value === null ? value : direction * value) : compareValue(a.key,b.key) * direction; };
  rows.sort((a,b) => compare(anchor(a),anchor(b)));
  const boundary = request.cursor;
  const candidates = boundary ? rows.filter(row => boundary.direction === 'next' ? compare(anchor(row),boundary.anchor) > 0 : compare(anchor(row),boundary.anchor) < 0) : rows;
  const data = boundary?.direction === 'previous' ? candidates.slice(-CURSOR_PAGE_SIZE) : candidates.slice(0,CURSOR_PAGE_SIZE);
  const first = data.length ? rows.findIndex(row => rowKey(row) === rowKey(data[0])) : 0;
  const info = makePageInfo(data,rows.length,first > 0,first + data.length < rows.length,first + 1,request,sort);
  return { data, pageInfo: info, total: rows.length };
}
