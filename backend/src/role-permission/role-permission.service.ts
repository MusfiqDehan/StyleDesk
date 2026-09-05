import { Injectable, OnModuleInit, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RolePermission, type EditableRole } from './entities/role-permission.entity.js';
import { Auth, UserRole } from '../auth/entities/auth.entity.js';
import {
  ALL_MODULE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  EDITABLE_ROLES,
} from './role-permission.defaults.js';

@Injectable()
export class RolePermissionService implements OnModuleInit {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(Auth)
    private readonly authRepo: Repository<Auth>,
  ) {}

  async onModuleInit() {
    // Tenant defaults are created explicitly by provisioning.
  }

  async ensureDefaults() {
    for (const role of EDITABLE_ROLES) {
      const existing = await this.rolePermissionRepo.findOne({ where: { role } });
      if (!existing) {
        await this.rolePermissionRepo.save(
          this.rolePermissionRepo.create({
            role,
            permissions: [...DEFAULT_ROLE_PERMISSIONS[role]],
          }),
        );
      }
    }
  }

  async findAll() {
    await this.ensureDefaults();
    const rows = await this.rolePermissionRepo.find();
    const byRole = new Map(rows.map((r) => [r.role, r]));
    return EDITABLE_ROLES.map((role) => {
      const row = byRole.get(role);
      return {
        role,
        permissions: row
          ? row.permissions
          : [...DEFAULT_ROLE_PERMISSIONS[role]],
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async findOne(role: string) {
    if (!EDITABLE_ROLES.includes(role as EditableRole)) {
      throw new BadRequestException(`Role '${role}' is not editable`);
    }
    await this.ensureDefaults();
    const row = await this.rolePermissionRepo.findOne({ where: { role: role as EditableRole } });
    if (!row) throw new NotFoundException(`Permissions for role '${role}' not found`);
    return {
      role: row.role,
      permissions: row.permissions,
      updatedAt: row.updatedAt,
    };
  }

  /** Effective module permissions for JWT / guards. */
  async resolveEffectivePermissions(role: UserRole, customPermissions?: string[] | null): Promise<string[]> {
    if (role === UserRole.ADMIN) {
      return [...ALL_MODULE_PERMISSIONS];
    }
    if (role === UserRole.CUSTOM) {
      return [...(customPermissions || [])];
    }
    if (role === UserRole.CUSTOMER) {
      return [];
    }
    if (EDITABLE_ROLES.includes(role as EditableRole)) {
      const row = await this.rolePermissionRepo.findOne({ where: { role: role as EditableRole } });
      if (row) return [...row.permissions];
      return [...DEFAULT_ROLE_PERMISSIONS[role as EditableRole]];
    }
    return [];
  }

  async updateRolePermissions(
    role: string,
    permissions: string[],
    requesterRole: UserRole,
  ) {
    if (!EDITABLE_ROLES.includes(role as EditableRole)) {
      throw new BadRequestException(`Role '${role}' is not editable`);
    }

    // Managers may only edit staff / stylist templates
    if (requesterRole === UserRole.STORE_MANAGER) {
      if (role === UserRole.STORE_MANAGER) {
        throw new ForbiddenException('Managers cannot edit Manager role permissions');
      }
      if (permissions.includes('user-management')) {
        throw new ForbiddenException('Managers cannot grant user-management');
      }
    }

    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.STORE_MANAGER) {
      throw new ForbiddenException('Only Admin or Manager can update role permissions');
    }

    const unique = Array.from(
      new Set(
        (permissions || [])
          .map((p) => String(p || '').trim())
          .filter((p) => (ALL_MODULE_PERMISSIONS as readonly string[]).includes(p)),
      ),
    );

    // Always keep update-password so accounts are not locked out of password change
    if (!unique.includes('update-password')) {
      unique.push('update-password');
    }

    let row = await this.rolePermissionRepo.findOne({ where: { role: role as EditableRole } });
    if (!row) {
      row = this.rolePermissionRepo.create({ role: role as EditableRole, permissions: unique });
    } else {
      row.permissions = unique;
    }
    await this.rolePermissionRepo.save(row);

    // Invalidate all active sessions for users with this role
    const invalidatedSessions = await this.bumpTokenVersionForRole(role as UserRole);

    return {
      role: row.role,
      permissions: row.permissions,
      updatedAt: row.updatedAt,
      invalidatedSessions,
      message: `Permissions updated. ${invalidatedSessions} active session(s) will require re-login.`,
    };
  }

  async bumpTokenVersionForRole(role: UserRole): Promise<number> {
    const users = await this.authRepo.find({ where: { role }, select: { id: true, tokenVersion: true } });
    if (users.length === 0) return 0;
    for (const u of users) {
      u.tokenVersion = (u.tokenVersion ?? 0) + 1;
    }
    await this.authRepo.save(users);
    return users.length;
  }

  async bumpTokenVersionForUser(authId: string): Promise<void> {
    const user = await this.authRepo.findOne({ where: { id: authId }, select: { id: true, tokenVersion: true } });
    if (!user) return;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.authRepo.save(user);
  }

  async bumpTokenVersionForUsers(authIds: string[]): Promise<number> {
    if (!authIds.length) return 0;
    const users = await this.authRepo.find({
      where: { id: In(authIds) },
      select: { id: true, tokenVersion: true },
    });
    for (const u of users) {
      u.tokenVersion = (u.tokenVersion ?? 0) + 1;
    }
    if (users.length) await this.authRepo.save(users);
    return users.length;
  }
}
