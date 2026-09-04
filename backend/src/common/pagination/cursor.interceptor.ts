import { platformMetricRows } from './platform-metrics.js';
import { cursorSummary } from './cursor-summary.js';
import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { tenantStorage } from '../../tenancy/tenant-context.js';
import { cursorScope, cursorStorage, decodeCursor, paginateRows, type CursorFilter, type CursorRequest } from './cursor.js';

// Cursor mode is opt-in. Existing catalog pickers, exports and integrations retain their contracts.
const LIST_ROUTES = [
  /^\/(clients|appointments|invoice|inventory|employee|service|StyleDesk-packages|testimonial|news-letter-subscriber|leave-request|user-management|announcement|attendance|payroll|role-permissions|branches|devices)\/?$/,
  /^\/(service|employee|StyleDesk-packages)\/(active|artists)\/?$/,
  /^\/finance(\/transactions|\/categories|\/category-options)?\/?$/,
  /^\/vouchers(\/categories)?\/?$/,
  /^\/reports(\/staff)?\/?$/,
  /^\/platform\/(tenants|users|roles|packages|subscriptions|payments|domains|audit|gateways)\/?$/,
  /^\/platform\/tenants\/[^/]+(\/(users|domains|audit|payments))?\/?$/,
  /^\/tenant-console\/(roles|invitations|domains|invoices)\/?$/,
  /^\/(device-users(\/unlinked)?|auth\/users|pos\/invoices|payments\/invoices|attendance\/today)\/?$/,
  /^\/clients\/history\/[^/]+\/?$/,
  /^\/(dashboard|manager-dashboard|staff-dashboard|auth\/customer-dashboard)\/?$/,
];
@Injectable()
export class CursorPaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const q = req.query;
    if (req.method !== 'GET' || q.pagination !== 'cursor') return next.handle();
    const path: string = req.path;
    if (!LIST_ROUTES.some(pattern => pattern.test(path))) throw new BadRequestException('This endpoint does not expose a cursor collection');
    const fieldPattern = /^[a-zA-Z][a-zA-Z0-9_.]{0,80}$/;
    if (q._sort && (typeof q._sort !== 'string' || !fieldPattern.test(q._sort))) throw new BadRequestException('Invalid sort field');
    if (q._order && !['asc','desc'].includes(q._order)) throw new BadRequestException('Invalid sort order');
    let filters: CursorFilter[] = [];
    try { filters = q._filters ? JSON.parse(q._filters) : []; } catch { throw new BadRequestException('Invalid table filters'); }
    if (!Array.isArray(filters) || filters.length > 20 || filters.some(f => !f || typeof f !== 'object' || typeof f.field !== 'string' || !fieldPattern.test(f.field) || !['eq','in','gte','lte','contains'].includes(f.op) || (f.op === 'in' && (!Array.isArray(f.value) || f.value.length > 100)))) throw new BadRequestException('Invalid table filters');
    if (typeof (q._search ?? '') !== 'string' || String(q._search ?? '').length > 512) throw new BadRequestException('Search is too long');
    if (q.collection && !fieldPattern.test(q.collection)) throw new BadRequestException('Invalid collection');
    const scope = tenantStorage.getStore();
    const query = Object.keys(q).sort().filter(key => !['cursor','page','limit'].includes(key)).map(key => [key,q[key]]);
    const signature = cursorScope([path,scope?.tenantId ?? req.headers.host,scope?.branchId,req.user?.id ?? req.user?.sub ?? req.platformUser?.id,req.headers['x-all-branches'],query]);
    const request: CursorRequest = { path, scope: signature, cursor: decodeCursor(q.cursor,signature), sort:q._sort, order:q._order ?? 'desc', search:q._search ?? '', filters };
    return new Observable(subscriber => cursorStorage.run(request, () => next.handle().pipe(map(result => {
      if (request.pageInfo) return { ...(Array.isArray(result) ? {} : result), data: Array.isArray(result) ? result : result.data, pageInfo: request.pageInfo, total: request.pageInfo.total };
      let rows = result;
      const collection = q.collection ? String(q.collection).split('.') : [];
      if (collection.length) for (const key of collection) rows = rows?.[key];
      else if (!Array.isArray(rows)) rows = rows?.data ?? rows?.items ?? rows?.rows;
      if (!Array.isArray(rows)) throw new BadRequestException('Select a table collection for this response');
      if (/^\/platform\/[^/]+\/?$/.test(path) && !collection.length) rows = platformMetricRows(path.split('/')[2], rows);
      const page = paginateRows(rows,request);
      const envelope = Array.isArray(result) ? {} : { ...result };
      if (collection.length) {
        let target: any = envelope;
        for (const field of collection.slice(0, -1)) {
          target[field] = { ...target[field] };
          target = target[field];
        }
        target[collection[collection.length - 1]] = page.data;
      } else {
        if (Array.isArray(envelope.items)) envelope.items = page.data;
        if (Array.isArray(envelope.rows)) envelope.rows = page.data;
      }
      // Summaries stay complete; the selected row collection alone is paginated.
      return { ...envelope, ...page, ...(path.startsWith('/platform/') && !collection.length ? { summary: cursorSummary(rows) } : {}) };
    })).subscribe(subscriber)));
  }
}
