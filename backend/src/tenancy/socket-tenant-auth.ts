import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Socket } from 'socket.io';
import { subscriptionOpen } from '../platform/access.service.js';
import { effectiveFeatures, expandLegacy, can } from '../platform/features.js';
import { tenantHostKey } from './host.js';
@Injectable()
export class SocketTenantAuth {
  constructor(
    private readonly jwt: JwtService,
    private readonly ds: DataSource,
  ) {}
  async authenticate(client: Socket) {
    const bearer = client.handshake.headers.authorization?.replace(
      /^Bearer\s+/i,
      '',
    );
    const cookie = client.handshake.headers.cookie?.match(
      /(?:^|;\s*)accessToken=([^;]+)/,
    )?.[1];
    const token =
      client.handshake.auth?.token ||
      bearer ||
      (cookie ? decodeURIComponent(cookie) : '');
    const payload = this.jwt.verify(token, { audience: 'styledesk-tenant' });
    const runner = this.ds.createQueryRunner();
    try {
      await runner.connect();
      const request = client.request;
      const trusted = (process.env.TRUSTED_PROXY_IPS ?? '')
        .split(',')
        .includes(request.socket.remoteAddress ?? '');
      const host = String(
        trusted
          ? (client.handshake.headers['x-forwarded-host'] ??
              client.handshake.headers.host)
          : client.handshake.headers.host,
      );
      const [tenant] = await runner.query(
        'SELECT * FROM resolve_tenant_host($1)',
        [tenantHostKey(host)],
      );
      if (!tenant || payload.tenantId !== tenant.tenant_id)
        throw new UnauthorizedException();
      await runner.startTransaction();
      await runner.query("SELECT set_config('app.tenant_id',$1,true)", [
        tenant.tenant_id,
      ]);
      const [auth] = await runner.query(
        'SELECT id,role,permissions,"tokenVersion",branch_id,active,custom_role_id FROM auth WHERE id=$1',
        [payload.id],
      );
      if (
        !auth ||
        !auth.active ||
        !payload.exp ||
        auth.role === 'customer' ||
        auth.role !== payload.role ||
        auth.tokenVersion !== (payload.tokenVersion ?? 0)
      )
        throw new UnauthorizedException();
      const branch =
        client.handshake.auth?.branchId || auth.branch_id || tenant.branch_id;
      if (auth.custom_role_id) {
        const [r] = await runner.query(
          'SELECT permissions,branch_scope FROM tenant_custom_role WHERE id=$1',
          [auth.custom_role_id],
        );
        if (!r) throw new UnauthorizedException();
        auth.permissions = r.permissions;
        auth.branchScope = r.branch_scope;
      }
      if (
        auth.role !== 'admin' &&
        auth.branchScope !== 'tenant' &&
        branch !== auth.branch_id
      )
        throw new UnauthorizedException();
      const [active] = await runner.query(
        'SELECT id FROM branch WHERE id=$1 AND tenant_id=$2 AND active',
        [branch, tenant.tenant_id],
      );
      if (!active) throw new UnauthorizedException();
      const [state] = await runner.query('SELECT tenant_access() AS state');
      if (!subscriptionOpen(state.state)) throw new UnauthorizedException();
      await runner.commitTransaction();
      client.data.user = {
        ...auth,
        tenantId: tenant.tenant_id,
        branchId: branch,
      };
      const features = effectiveFeatures(
        state.state.features,
        state.state.overrides,
      );
      const permissions =
        auth.role === 'admin' ? ['*'] : expandLegacy(auth.permissions ?? []);
      for (const capability of ['appointments', 'invoice', 'attendance']) {
        const room = `tenant:${tenant.tenant_id}:branch:${branch}:notifications:${capability}`;
        if (
          features.includes(capability) &&
          can(permissions, capability, 'view')
        )
          await client.join(room);
        else await client.leave(room);
      }
      if (!client.data.authMonitoring) {
        client.data.authMonitoring = true;
        const timer = setInterval(() => {
          void this.authenticate(client).catch(() => client.disconnect(true));
        }, 15000);
        timer.unref();
        client.once('disconnect', () => clearInterval(timer));
      }
      if (!client.data.authExpiry) {
        client.data.authExpiry = true;
        const expiry = setTimeout(
          () => client.disconnect(true),
          Math.min(2147483647, Math.max(0, payload.exp * 1000 - Date.now())),
        );
        expiry.unref();
        client.once('disconnect', () => clearTimeout(expiry));
      }
      return auth;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
