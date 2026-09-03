import { requireScope } from '../tenancy/tenant-context.js';
import { ForbiddenException } from '@nestjs/common';
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const allowed = await super.canActivate(context);
    const req = context.switchToHttp().getRequest();
    const scope = requireScope();
    const user = req.user;
    if (user.branchScope !== 'tenant' && user.role !== 'admin' && user.role !== 'customer') {
      if (!user.branchId || (req.headers['x-branch-id'] && req.headers['x-branch-id'] !== user.branchId)) throw new ForbiddenException('Home branch access only');
      scope.branchId = user.branchId;
      const [branch] = await scope.runner.query('SELECT id FROM branch WHERE id=$1 AND tenant_id=$2 AND active', [user.branchId, scope.tenantId]);
      if (!branch) throw new ForbiddenException('Inactive branch');
      await scope.runner.query("SELECT set_config('app.branch_id', $1, true)", [user.branchId]);
      const devices = await scope.runner.query('SELECT id FROM registered_device WHERE branch_id=$1 AND active ORDER BY id', [user.branchId]);
      const selectedDevice = req.headers['x-device-id'];
      if (selectedDevice && !devices.some((device: any) => device.id === selectedDevice)) throw new ForbiddenException('Home branch device access only');
      scope.deviceId = selectedDevice || devices[0]?.id;
      await scope.runner.query("SELECT set_config('app.device_id',$1,true)", [scope.deviceId ?? '']);
    }
    const aggregate = req.headers['x-all-branches'] === 'true';
    if (aggregate) {
      if ((user.role !== 'admin' && user.branchScope !== 'tenant') || req.method !== 'GET' || !/^\/(dashboard|reports|staff-reports)(\/|$)/.test(req.path)) throw new ForbiddenException('All branches is available only for admin reports');
      scope.branchId = null;
      await scope.runner.query("SELECT set_config('app.all_branches','true',true),set_config('app.branch_id','',true)");
    }
    if (user.role === 'customer' && req.method === 'GET' && req.path.startsWith('/auth/')) {
      await scope.runner.query("SELECT set_config('app.all_branches','true',true)");
    }
    await scope.runner.query("SELECT set_config('app.auth_id',$1,true),set_config('app.restrict_auth',$2,true)", [user.id, user.role === 'admin' || user.branchScope === 'tenant' || (req.accessEnforced && (req.path.startsWith('/user-management') || req.path === '/auth/users')) ? 'false' : 'true']);
    return Boolean(allowed);
  }
}
