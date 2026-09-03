import { requireScope } from '../tenancy/tenant-context.js';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { requireJwtSecret } from './require-jwt-secret.js';
import { Auth, UserRole } from './entities/auth.entity.js';
import { RolePermission, type EditableRole } from '../role-permission/entities/role-permission.entity.js';
import { ALL_MODULE_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../role-permission/role-permission.defaults.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
    @InjectRepository(RolePermission) private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {
    const secret = requireJwtSecret(configService.get<string>('JWT_SECRET'));
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.accessToken as string;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      audience: 'styledesk-tenant',
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    tenantId: string;
    id: string;
    useremail: string;
    role: string;
    permissions?: string[];
    tokenVersion?: number;
    employeeId?: string | null;
    employeeName?: string | null;
    name?: string | null;
    isCustomer?: boolean;
  }) {
    if (!payload?.id || payload.tenantId !== requireScope().tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    // Every active login issues an Auth ID. Deleted accounts must fail closed.
    const auth = await this.authRepository.findOne({
      where: { id: payload.id },
      select: { id: true, tokenVersion: true, role: true, useremail: true, tenantId: true, branchId: true, active: true, customRoleId: true, permissions: true },
      loadEagerRelations: false,
    });

    if (!auth || !auth.active || auth.role !== payload.role) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const tokenVersion = payload.tokenVersion ?? 0;
    const currentVersion = auth.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    let permissions: string[];
    if (auth.role === UserRole.ADMIN) permissions = [...ALL_MODULE_PERMISSIONS];
    else if (auth.role === UserRole.CUSTOM) permissions = [...(auth.permissions ?? [])];
    else if (auth.role === UserRole.CUSTOMER) permissions = [];
    else {
      const template = await this.rolePermissionRepository.findOne({ where: { role: auth.role as EditableRole } });
      permissions = template ? [...template.permissions] : [...(DEFAULT_ROLE_PERMISSIONS[auth.role as EditableRole] ?? [])];
    }
    let branchScope = auth.role === UserRole.ADMIN ? 'tenant' : 'home';
    if (auth.customRoleId) {
      const [custom] = await requireScope().runner.query('SELECT permissions,branch_scope FROM tenant_custom_role WHERE id=$1', [auth.customRoleId]);
      if (!custom) throw new UnauthorizedException('Role removed');
      permissions = custom.permissions; branchScope = custom.branch_scope;
    }
    return {
      customRoleId: auth.customRoleId, branchScope,
      tenantId: auth.tenantId,
      branchId: auth.branchId,
      id: payload.id,
      useremail: payload.useremail,
      role: payload.role,
      permissions,
      tokenVersion: payload.tokenVersion ?? 0,
      employeeId: payload.employeeId ?? null,
      employeeName: payload.employeeName ?? null,
      name: payload.name ?? null,
      isCustomer: payload.isCustomer ?? false,
    };
  }
}
