import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { requireScope, tenantStorage } from '../tenancy/tenant-context.js';
import {
  effectiveFeatures,
  expandLegacy,
  can,
  featureForRoute,
  FEATURES,
} from './features.js';
export function subscriptionOpen(s: any, now = Date.now()): boolean {
  if (!s?.active || !s.emailVerified) return false;
  if (s.status === 'active')
    return (
      !s.endsAt ||
      Date.parse(s.endsAt) > now ||
      (!!s.graceUntil && Date.parse(s.graceUntil) > now)
    );
  if (s.status === 'trial') return Date.parse(s.endsAt) > now;
  if (s.status === 'complimentary')
    return Date.parse(s.complimentaryUntil) > now;
  if (s.status === 'past_due') return Date.parse(s.graceUntil) > now;
  return false;
}
@Injectable()
export class AccessService {
  async state() {
    const [r] = await requireScope().runner.query(
      'SELECT tenant_access() AS state',
    );
    if (!r?.state)
      throw new ServiceUnavailableException(
        'Subscription configuration required',
      );
    return {
      ...r.state,
      features: effectiveFeatures(r.state.features, r.state.overrides),
      operational: subscriptionOpen(r.state),
    };
  }
  async bootstrap(user: any) {
    const state = await this.state();
    const permissions =
      user?.role === 'admin' ? ['*'] : expandLegacy(user?.permissions ?? []);
    return {
      user: { ...user, permissions },
      ...state,
      catalog: FEATURES.map(([key, label, path]) => ({ key, label, path })),
      permissions,
    };
  }
  async require(key: string, action: string, user: any) {
    const s = await this.state();
    if (!s.operational)
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message:
          'Business access is unavailable. Contact the owner or renew the subscription.',
      });
    if (!s.features.includes(key))
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        feature: key,
        message: 'This feature is disabled for your business',
      });
    if (
      !user ||
      user.role === 'customer' ||
      !can(
        user.role === 'admin' ? ['*'] : expandLegacy(user.permissions ?? []),
        key,
        action,
      )
    )
      throw new ForbiddenException('Missing action permission');
  }
}
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(private access: AccessService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.platformHost || !tenantStorage.getStore()) return true;
    const path = req.path;
    const root = path.split('/')[1];
    if (
      ['access', 'tenant-console', 'payments'].includes(root) ||
      (root === 'auth' && path !== '/auth/users')
    )
      return true;
    const state = await this.access.state();
    // Branding/visibility is needed by login and recovery, even when the subscription ends.
    if (
      path === '/bussiness-info/site-visibility' ||
      (path === '/bussiness-info' && req.method === 'GET') ||
      path === '/health' ||
      path === '/'
    )
      return true;
    if (
      req.method === 'GET' &&
      (path === '/branches/public' || path === '/branches')
    ) {
      if (!state.operational)
        throw new ForbiddenException('Subscription inactive');
      return true;
    }
    const key =
      path === '/auth/users'
        ? 'user-management'
        : featureForRoute(path, req.method);
    if (!key) return true;
    if (key === '__unclassified__')
      throw new ForbiddenException('Unclassified API route');
    if (!state.operational)
      throw new ForbiddenException('Subscription inactive');
    // Booking/catalog APIs share business capabilities with authenticated back-office pages.
    const publicKey = key;
    if (
      key.startsWith('website.') &&
      req.method === 'GET' &&
      !state.features.includes('landing-page')
    )
      throw new ForbiddenException('Website disabled');
    if (!state.features.includes(publicKey))
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        feature: publicKey,
        message: 'Feature disabled',
      });
    if (!req.user) {
      return true;
    }
    if (req.user.role === 'customer')
      throw new ForbiddenException(
        'Customer accounts cannot access business modules',
      );

    if (
      ['user-management', 'role-permissions'].includes(root) &&
      req.method !== 'GET' &&
      req.user.role !== 'admin'
    ) {
      if (req.body?.role === 'admin')
        throw new ForbiddenException('Cannot grant owner access');
      if (
        Array.isArray(req.body?.permissions) &&
        expandLegacy(req.body.permissions).some(
          (p) => !expandLegacy(req.user.permissions ?? []).includes(p),
        )
      )
        throw new ForbiddenException('Cannot grant elevated permissions');
    }
    if (
      req.user.branchScope === 'tenant' &&
      req.method !== 'GET' &&
      [
        'pos',
        'invoice',
        'appointments',
        'employee',
        'inventory',
        'finance',
        'attendance',
        'payroll',
        'leave-request',
        'announcement',
      ].includes(root) &&
      !req.headers['x-branch-id']
    )
      throw new ForbiddenException('Select a branch for this operation');
    const action =
      req.method === 'GET'
        ? path.includes('export')
          ? 'export'
          : 'view'
        : req.method === 'POST'
          ? 'create'
          : req.method === 'DELETE'
            ? 'delete'
            : 'edit';
    // Invoice APIs are also needed by POS. Each caller must have an applicable entitlement AND permission.
    const alternatives = [key];
    const permitted = alternatives.some(
      (k) =>
        state.features.includes(k) &&
        can(
          req.user.role === 'admin'
            ? ['*']
            : expandLegacy(req.user.permissions ?? []),
          k,
          action,
        ),
    );
    if (!permitted) throw new ForbiddenException('Missing action permission');
    if (key === 'user-management') {
      // Authorized account endpoints apply home-branch and role checks themselves.
      await requireScope().runner.query("SELECT set_config('app.restrict_auth','false',true)");
    }
    req.accessEnforced = true;
    return true;
  }
}
