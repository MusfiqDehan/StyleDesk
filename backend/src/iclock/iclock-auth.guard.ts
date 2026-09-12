import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
@Injectable()
export class IclockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!context.switchToHttp().getRequest().tenantScope?.deviceId) throw new UnauthorizedException('Registered device authentication required');
    return true;
  }
}
