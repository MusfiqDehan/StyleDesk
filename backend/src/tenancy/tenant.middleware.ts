import { Injectable, NestMiddleware, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Request, Response, NextFunction } from 'express';
import { tenantStorage, type TenantScope } from './tenant-context.js';
import { tenantHostKey, isPlatformHost, normalizeHost } from './host.js';
import { createHash } from 'node:crypto';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly dataSource: DataSource) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const pathname = req.originalUrl.split('?')[0];
    if (pathname === '/health' || pathname.startsWith('/uploads/')) return next();
    const trustedHost = (process.env.TRUSTED_PROXY_IPS ?? '').split(',').includes(req.socket.remoteAddress ?? '');
    const incomingHost = String(trustedHost ? req.headers['x-forwarded-host'] ?? req.headers.host ?? '' : req.headers.host ?? '');
    if (isPlatformHost(incomingHost)) {
      (req as any).platformHost = true;
      if (pathname.startsWith('/platform/') || pathname === '/health') return next();
      return next(new NotFoundException('Tenant API unavailable on platform host'));
    }
    if (pathname.startsWith('/platform/')) return next(new NotFoundException('Platform host required'));
    if (pathname === '/domain-proof' && req.method === 'GET') {
      (req as any).domainProofHost = normalizeHost(incomingHost);
      return next();
    }
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      let tenantId: string; let branchId: string; let deviceId: string | undefined;
      if (pathname.startsWith('/iclock/') || pathname === '/attendance/biometric/punch') {
        // The function exposes only authenticated registration context, not device credentials.
        const serial = String(req.query.SN ?? req.query.sn ?? req.headers['x-device-serial'] ?? '').toUpperCase();
        const secret = String(req.headers['x-iclock-key'] ?? req.headers['x-punch-key'] ?? req.query.key ?? '');
        const rows = await runner.query('SELECT * FROM resolve_device($1, $2, $3)', [serial, createHash('sha256').update(secret).digest('hex'), req.socket.remoteAddress?.replace(/^::ffff:/, '')]);
        if (!rows[0]) throw new NotFoundException('Unknown device');
        ({ tenant_id: tenantId, branch_id: branchId, device_id: deviceId } = rows[0]);
      } else {
        const trusted = (process.env.TRUSTED_PROXY_IPS ?? '').split(',').includes(req.socket.remoteAddress ?? '');
        const host = trusted ? String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '') : String(req.headers.host ?? '');
        const rows = await runner.query('SELECT * FROM resolve_tenant_host($1)', [tenantHostKey(host)]);
        if (!rows[0]) throw new NotFoundException('Unknown salon');
        tenantId = rows[0].tenant_id;
        branchId = rows[0].branch_id;
      }
      await runner.startTransaction();
      await runner.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const requested = (pathname.startsWith('/iclock/') || pathname === '/attendance/biometric/punch') ? undefined : req.headers['x-branch-id'];
      if (requested) {
        if (typeof requested !== 'string' || !/^[0-9a-f-]{36}$/i.test(requested)) throw new BadRequestException('Invalid branch');
        const branches = await runner.query('SELECT id FROM branch WHERE id=$1 AND tenant_id=$2 AND active', [requested, tenantId]);
        if (!branches[0]) throw new NotFoundException('Unknown branch');
        branchId = requested;
      }
      await runner.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.branch_id', $2, true), set_config('app.device_id', $3, true), set_config('app.all_branches', 'false', true)", [tenantId, branchId, deviceId ?? '']);
      const deviceHeader = (pathname.startsWith('/iclock/') || pathname === '/attendance/biometric/punch') ? undefined : req.headers['x-device-id'];
      const devices = await runner.query('SELECT id FROM registered_device WHERE tenant_id=$1 AND branch_id=$2 AND active ORDER BY id', [tenantId, branchId]);
      if (deviceHeader) {
        if (!devices.some((d: any) => d.id === deviceHeader)) throw new NotFoundException('Unknown device');
        deviceId = String(deviceHeader);
      } else if (!deviceId) deviceId = devices[0]?.id;
      await runner.query("SELECT set_config('app.device_id', $1, true)", [deviceId ?? '']);
      const scope: TenantScope = { tenantId, branchId, deviceId, runner, afterCommit: [] };
      (req as any).tenantScope = scope;
      let finished = false;
      const end = res.end.bind(res);
      res.end = ((...args: any[]) => {
        if (finished) return res;
        finished = true;
        void (async () => {
          try {
            if (res.statusCode >= 400 && !scope.persistSecurityFailure) await runner.rollbackTransaction();
            else { await runner.commitTransaction(); for (const effect of res.statusCode < 400 ? scope.afterCommit : []) { try { await effect(); } catch (error) { console.error('Post-commit effect failed', error); } } }
            await runner.release();
            (end as any)(...args);
          } catch (error) {
            if (runner.isTransactionActive) await runner.rollbackTransaction();
            await runner.release();
            res.statusCode = 500;
            res.removeHeader('Content-Length');
            end(JSON.stringify({ message: 'Request transaction failed' }));
          }
        })();
        return res;
      }) as any;
      res.once('close', () => {
        if (!finished) { finished = true; void (async () => { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); })(); }
      });
      tenantStorage.run(scope, next);
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
      next(error);
    }
  }
}
