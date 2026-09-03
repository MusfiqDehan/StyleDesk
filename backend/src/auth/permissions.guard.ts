import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './entities/auth.entity.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('User not authenticated');

    if (context.switchToHttp().getRequest().accessEnforced) return true;

    // Customers have no admin module access
    if (user.role === UserRole.CUSTOMER || user.isCustomer) {
      throw new ForbiddenException('You do not have permission to access this module');
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Effective permissions come from the current tenant-scoped account/template.
    if (!requiredPermissions?.length) {
      // Route has no @Permissions — allow authenticated non-customer roles
      // (RolesGuard may still restrict). Custom users without any permission
      // on a bare route stay blocked to avoid accidental full access.
      if (user.role === UserRole.CUSTOM) {
        throw new ForbiddenException('Custom users are restricted to specific permitted modules only');
      }
      return true;
    }

    const userPermissions: string[] = user.permissions || [];
    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permissions to access this module');
    }
    return true;
  }
}
