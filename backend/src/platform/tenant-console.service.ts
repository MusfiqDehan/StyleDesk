import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlatformService } from './platform.service.js';
import { AccessService } from './access.service.js';
import { requireScope } from '../tenancy/tenant-context.js';
import { ACTIONS, featureKeys, can, expandLegacy } from './features.js';
import { email, password, required, uuid, list } from './validation.js';
import { hashToken } from './crypto.js';
import { randomBytes } from 'node:crypto';
import { domainToASCII } from 'node:url';
import * as bcrypt from 'bcrypt';
@Injectable()
export class TenantConsoleService {
  constructor(
    private platform: PlatformService,
    private access: AccessService,
  ) {}
  async usage(user: any) {
    if (user.role !== 'admin')
      await this.access.require('user-management', 'view', user);
    const [r] = await this.platform.db.query(
      'SELECT platform_usage($1) AS usage',
      [requireScope().tenantId],
    );
    const subscription = await this.access.state();
    return {
      ...r.usage,
      staffRemaining: Math.max(
        0,
        subscription.staffLimit -
          Number(r.usage.staff) -
          Number(r.usage.reserved),
      ),
      customerRemaining: Math.max(
        0,
        subscription.customerLimit - Number(r.usage.customers),
      ),
      staffOverLimit: Number(r.usage.staff) > subscription.staffLimit,
      customerOverLimit: Number(r.usage.customers) > subscription.customerLimit,
      subscription,
    };
  }
  async roles(user: any) {
    await this.access.require('roles', 'view', user);
    return requireScope().runner.query(
      'SELECT * FROM tenant_custom_role ORDER BY name',
    );
  }
  async saveRole(id: string | null, b: any, user: any) {
    await this.access.require('roles', 'manage', user);
    const permissions = list(
      b.permissions,
      featureKeys.flatMap((k) => ACTIONS.map((a) => `${k}:${a}`)),
    );
    if (
      user.role !== 'admin' &&
      permissions.some((p) => !expandLegacy(user.permissions).includes(p))
    )
      throw new ForbiddenException('Cannot grant permissions you do not hold');
    if (
      b.branch_scope === 'tenant' &&
      user.branchScope !== 'tenant' &&
      user.role !== 'admin'
    )
      throw new ForbiddenException('Cannot grant tenant-wide access');
    const branch = b.branch_scope === 'tenant' ? 'tenant' : 'home';
    const scope = requireScope();
    const result = id
      ? await scope.runner.query(
          'UPDATE tenant_custom_role SET name=$2,permissions=$3,branch_scope=$4 WHERE id=$1 RETURNING id',
          [
            uuid(id),
            required(b.name, 'name'),
            JSON.stringify(permissions),
            branch,
          ],
        )
      : await scope.runner.query(
          'INSERT INTO tenant_custom_role(tenant_id,name,permissions,branch_scope) VALUES($1,$2,$3,$4) RETURNING id',
          [
            scope.tenantId,
            required(b.name, 'name'),
            JSON.stringify(permissions),
            branch,
          ],
        );
    if (!result[0]) throw new NotFoundException();
    await scope.runner.query(
      'UPDATE auth SET "tokenVersion"="tokenVersion"+1 WHERE custom_role_id=$1',
      [result[0].id],
    );
    return result[0];
  }
  async invitations(user: any) {
    await this.access.require('user-management', 'view', user);
    return this.platform.db.query(
      "SELECT id,email,role_id,branch_id,expires_at,accepted_at,revoked_at FROM platform_invitation WHERE realm='tenant' AND tenant_id=$1 AND ($2::uuid IS NULL OR branch_id=$2) ORDER BY created_at DESC",
      [
        requireScope().tenantId,
        user.role === 'admin' || user.branchScope === 'tenant'
          ? null
          : user.branchId,
      ],
    );
  }
  async invite(b: any, user: any) {
    await this.access.require('user-management', 'invite', user);
    const scope = requireScope();
    const defaultRole = (
      await scope.runner.query(
        "SELECT id FROM tenant_custom_role WHERE name='Staff'",
      )
    )[0];
    const role = b.role_id ? uuid(b.role_id) : (defaultRole?.id ?? null);
    let branch = scope.branchId;
    if (role) {
      const [r] = await scope.runner.query(
        'SELECT * FROM tenant_custom_role WHERE id=$1',
        [role],
      );
      if (!r) throw new BadRequestException('Unknown role');
      if (
        user.role !== 'admin' &&
        user.branchScope !== 'tenant' &&
        r.branch_scope === 'tenant'
      )
        throw new ForbiddenException('Cannot grant tenant-wide access');
      if (
        user.role !== 'admin' &&
        r.permissions.some(
          (p: string) => !expandLegacy(user.permissions).includes(p),
        )
      )
        throw new ForbiddenException('Cannot grant elevated role');
      if (
        b.branch_id &&
        user.role !== 'admin' &&
        user.branchScope !== 'tenant' &&
        b.branch_id !== user.branchId
      )
        throw new ForbiddenException('Home branch only');
      if (b.branch_id) {
        const [v] = await scope.runner.query(
          'SELECT id FROM branch WHERE id=$1 AND active',
          [uuid(b.branch_id)],
        );
        if (!v) throw new BadRequestException('Invalid branch');
        branch = v.id;
      }
    }
    return this.platform.db.transaction(async (m) => {
      await m.query(
        'SELECT tenant_id FROM tenant_subscription WHERE tenant_id=$1 FOR UPDATE',
        [scope.tenantId],
      );
      const [u] = await m.query('SELECT platform_usage($1) AS usage', [
        scope.tenantId,
      ]);
      const state = await this.access.state();
      if (Number(u.usage.staff) + Number(u.usage.reserved) >= state.staffLimit)
        throw new BadRequestException('Staff seat limit reached');
      const result = await this.platform.link(
        m,
        'tenant',
        email(b.email),
        scope.tenantId,
        role,
        branch,
      );
      await this.platform.audit(
        m,
        user.id,
        scope.tenantId,
        'tenant.invite',
        null,
        { email: email(b.email), role },
      );
      return result;
    });
  }
  async accept(b: any) {
    const scope = requireScope();
    return this.platform.db.transaction(async (m) => {
      const [i] = await m.query(
        "SELECT * FROM platform_invitation WHERE token_hash=$1 AND tenant_id=$2 AND realm='tenant' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
        [hashToken(required(b.token, 'token', 128)), scope.tenantId],
      );
      if (!i) throw new BadRequestException('Invalid invitation');
      const pw = await bcrypt.hash(password(b.password), 12); // Use a narrow DB function to consume the reservation and create the account atomically.
      await m.query('SELECT platform_accept_staff($1,$2)', [i.id, pw]);
      return { message: 'Account ready. Sign in.' };
    });
  }
  async revoke(id: string, user: any) {
    await this.access.require('user-management', 'invite', user);
    await this.platform.db.query(
      `UPDATE platform_invitation SET revoked_at=now() WHERE id=$1 AND tenant_id=$2 AND realm='tenant' AND ($3::uuid IS NULL OR branch_id=$3) AND accepted_at IS NULL`,
      [
        uuid(id),
        requireScope().tenantId,
        user.role === 'admin' || user.branchScope === 'tenant'
          ? null
          : user.branchId,
      ],
    );
    return { message: 'Invitation revoked' };
  }
  async resend(id: string, user: any) {
    await this.access.require('user-management', 'invite', user);
    const scope = requireScope();
    const [i] = await this.platform.db.query(
      "SELECT id FROM platform_invitation WHERE id=$1 AND tenant_id=$2 AND realm='tenant' AND ($3::uuid IS NULL OR branch_id=$3)",
      [
        uuid(id),
        scope.tenantId,
        user.role === 'admin' || user.branchScope === 'tenant'
          ? null
          : user.branchId,
      ],
    );
    if (!i) throw new NotFoundException();
    return this.platform.resend(id, user.id);
  }
  async assign(id: string, b: any, user: any) {
    await this.access.require('user-management', 'manage', user);
    const scope = requireScope();
    await scope.runner.query("SELECT set_config('app.restrict_auth','false',true)");
    const [a] = await scope.runner.query(
      'SELECT * FROM auth WHERE id=$1 FOR UPDATE',
      [uuid(id)],
    );
    if (
      a &&
      user.role !== 'admin' &&
      user.branchScope !== 'tenant' &&
      a.branch_id !== user.branchId
    )
      throw new ForbiddenException('Home branch only');
    if (!a || a.role === 'admin')
      throw new ForbiddenException('Owner assignment is protected');
    const role = b.role_id ? uuid(b.role_id) : null;
    if (role) {
      const [r] = await scope.runner.query(
        'SELECT * FROM tenant_custom_role WHERE id=$1',
        [role],
      );
      if (!r) throw new BadRequestException('Unknown role');
      if (
        user.role !== 'admin' &&
        user.branchScope !== 'tenant' &&
        r.branch_scope === 'tenant'
      )
        throw new ForbiddenException('Cannot grant tenant-wide access');
      if (
        user.role !== 'admin' &&
        r.permissions.some(
          (p: string) => !expandLegacy(user.permissions).includes(p),
        )
      )
        throw new ForbiddenException('Cannot elevate permissions');
    }
    if (b.active !== undefined && typeof b.active !== 'boolean')
      throw new BadRequestException('Invalid active state');
    await scope.runner.query(
      `UPDATE auth SET role=CASE WHEN role::text='customer' AND $2::uuid IS NULL THEN role ELSE 'custom'::auth_role_enum END,permissions=NULL,custom_role_id=$2,active=$3,"tokenVersion"="tokenVersion"+1 WHERE id=$1`,
      [id, role, b.active ?? a.active],
    );
    return { message: 'Account updated' };
  }
  async domains(user: any) {
    await this.access.require('domains', 'view', user);
    const s = await this.access.state();
    return {
      default_url: (await import('./platform.service.js')).tenantOrigin(s.slug),
      domains: await this.platform.db.query(
        'SELECT * FROM tenant_domain WHERE tenant_id=$1 ORDER BY created_at',
        [requireScope().tenantId],
      ),
      target: process.env.DOMAIN_CNAME_TARGET ?? process.env.PLATFORM_HOST,
      ip: process.env.DOMAIN_PUBLIC_IP ?? null,
    };
  }
  async addDomain(b: any, user: any) {
    await this.access.require('domains', 'manage', user);
    const hostname = domainToASCII(
      required(b.hostname, 'hostname', 253).toLowerCase().replace(/\.$/, ''),
    );
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        hostname,
      ) ||
      hostname === process.env.PLATFORM_HOST ||
      hostname.endsWith('.' + process.env.TENANT_BASE_DOMAIN) ||
      /\.(local|localhost|internal|test|invalid|example)$/.test(hostname) ||
      /^\d+\./.test(hostname)
    )
      throw new BadRequestException(
        'Use a publicly routable tenant-owned hostname',
      );
    const [id] = await this.platform.db.query(
      'INSERT INTO tenant_domain(tenant_id,hostname,verification_token) VALUES($1,$2,$3) RETURNING *',
      [requireScope().tenantId, hostname, randomBytes(24).toString('hex')],
    );
    return { ...id, txt_name: `_styledesk.${hostname}` };
  }
  async updateDomain(id: string, b: any, user: any) {
    await this.access.require('domains', 'manage', user);
    const tid = requireScope().tenantId;
    return this.platform.db.transaction(async (m) => {
      const [d] = await m.query(
        'SELECT * FROM tenant_domain WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
        [uuid(id), tid],
      );
      if (!d) throw new NotFoundException();
      if (b.is_primary === true) {
        if (d.status !== 'active')
          throw new BadRequestException('Domain must be active');
        await m.query(
          'UPDATE tenant_domain SET is_primary=false WHERE tenant_id=$1',
          [tid],
        );
        await m.query('UPDATE tenant_domain SET is_primary=true WHERE id=$1', [
          id,
        ]);
      }
      if (b.retry)
        await m.query(
          "UPDATE tenant_domain SET status='pending',next_check=now(),last_error=NULL WHERE id=$1",
          [id],
        );
      if (b.disabled)
        await m.query(
          "UPDATE tenant_domain SET status='disabled',is_primary=false WHERE id=$1",
          [id],
        );
      return { message: 'Domain updated' };
    });
  }
  async subscription(user: any) {
    if (user.role !== 'admin')
      throw new ForbiddenException('Owner access required');
    const [s] = await this.platform.db.query(
      'SELECT s.*,v.name,v.monthly,v.yearly,v.currency FROM tenant_subscription s JOIN platform_package_version v ON(v.package_id,v.version)=(s.package_id,s.package_version) WHERE tenant_id=$1',
      [requireScope().tenantId],
    );
    return { ...s, packages: await this.platform.packages(true) };
  }
  async subscriptionChange(b: any, user: any) {
    if (user.role !== 'admin')
      throw new ForbiddenException('Owner access required');
    const tid = requireScope().tenantId;
    await this.platform.db.transaction(async (m) => {
      const [s] = await m.query(
        'SELECT * FROM tenant_subscription WHERE tenant_id=$1 FOR UPDATE',
        [tid],
      );
      if (b.package_id) {
        const [p] = await m.query(
          'SELECT id,current_version FROM platform_package WHERE id=$1 AND published',
          [uuid(b.package_id)],
        );
        if (!p)
          throw new BadRequestException(
            'Select a published subscription package',
          );
        await m.query(
          'UPDATE tenant_subscription SET next_package_id=$2,next_package_version=$3,next_interval=$4,revision=revision+1 WHERE tenant_id=$1',
          [
            tid,
            p.id,
            p.current_version,
            b.interval === 'yearly' ? 'yearly' : 'monthly',
          ],
        );
      }
      if (b.cancel_at_period_end !== undefined) {
        if (typeof b.cancel_at_period_end !== 'boolean')
          throw new BadRequestException('Invalid cancellation flag');
        await m.query(
          'UPDATE tenant_subscription SET cancel_at_period_end=$2,revision=revision+1 WHERE tenant_id=$1',
          [tid, b.cancel_at_period_end],
        );
      }
      await this.platform.audit(m, user.id, tid, 'subscription.request', s, b);
    });
    return { message: 'Change scheduled for the next billing boundary' };
  }
}
