import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlatformDb } from './platform-db.js';
import { can } from './features.js';
const PUBLIC = new Set([
  'login',
  'packages/public',
  'onboard',
  'activate',
  'reset/request',
  'reset/confirm',
  'invite/accept',
  'payments/available-gateways',
  'payments/ipn',
  'payments/webhooks/stripe',
  'payments/success',
  'payments/fail',
  'payments/cancel',
  'payments/status',
  'payments/onboarding',
  'onboarding/status',
]);
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private db: PlatformDb,
    private jwt: JwtService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (!req.platformHost)
      throw new ForbiddenException('Platform host required');
    const tail = req.path.replace(/^\/platform\/?/, '');
    if (PUBLIC.has(tail)) return true;
    let payload: any;
    try {
      payload = this.jwt.verify(
        req.cookies?.platformToken ??
          req.headers.authorization?.replace(/^Bearer /, ''),
        {
          secret: process.env.PLATFORM_JWT_SECRET,
          audience: 'styledesk-platform',
        },
      );
    } catch {
      throw new UnauthorizedException();
    }
    const [u] = await this.db.query(
      'SELECT a.id,a.email,a.active,a.token_version,r.name AS role,r.permissions FROM platform_account a JOIN platform_role r ON r.id=a.role_id WHERE a.id=$1',
      [payload.id],
    );
    if (!u?.active || u.token_version !== payload.version)
      throw new UnauthorizedException();
    req.platformUser = u;
    const resource = tail.split('/')[0];
    const action =
      req.method === 'GET'
        ? 'view'
        : tail.includes('invite')
          ? 'invite'
          : req.method === 'DELETE'
            ? 'delete'
            : req.method === 'POST'
              ? 'create'
              : 'edit';
    if (
      !['me', 'logout', 'catalog'].includes(resource) &&
      !can(
        u.permissions,
        resource === 'stats'
          ? 'overview'
          : resource === 'invitations'
            ? 'users'
            : resource,
        action,
      ) &&
      !can(u.permissions, resource, 'manage')
    )
      throw new ForbiddenException('Missing platform permission');
    return true;
  }
}
