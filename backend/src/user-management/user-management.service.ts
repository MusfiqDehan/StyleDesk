import { scopedManager } from '../tenancy/tenant-context.js';
import { expandLegacy } from '../platform/features.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/role-permission.defaults.js';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Auth, UserRole } from '../auth/entities/auth.entity.js';
import { CreateUserManagementDto } from './dto/create-user-management.dto.js';
import { UpdateUserManagementDto } from './dto/update-user-management.dto.js';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createUserManagementDto: CreateUserManagementDto,
    creatorRole: UserRole,
  ) {
    throw new BadRequestException(
      'Staff accounts are invite-only. Use tenant-console/invitations.',
    );
  }

  async findAll(email?: string, actor?: any) {
    return this.authRepository.find({
      where: {
        ...(email ? { useremail: ILike(`%${email}%`) } : {}),
        ...(actor &&
        actor.role !== UserRole.ADMIN &&
        actor.branchScope !== 'tenant'
          ? { branchId: actor.branchId }
          : {}),
      },
      select: {
        id: true,
        useremail: true,
        role: true,
        permissions: true,
        employeeId: true,
        createdAt: true,
        updatedAt: true,
        active: true,
        customRoleId: true,
        branchId: true,
      },
      relations: { employee: true },
    });
  }

  async findOne(id: string, actor?: any) {
    const user = await this.authRepository.findOne({
      where: { id },
      select: {
        id: true,
        useremail: true,
        role: true,
        permissions: true,
        employeeId: true,
        createdAt: true,
        updatedAt: true,
        active: true,
        customRoleId: true,
        branchId: true,
      },
      relations: { employee: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (
      actor &&
      actor.role !== UserRole.ADMIN &&
      actor.branchScope !== 'tenant' &&
      user.branchId !== actor.branchId
    )
      throw new ForbiddenException('Home branch only');
    return user;
  }

  async update(
    id: string,
    updateUserManagementDto: UpdateUserManagementDto,
    actor: any,
  ) {
    const { role, password, ...rest } = updateUserManagementDto;
    const user = await this.authRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (actor.role === UserRole.STORE_MANAGER && user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Store Managers cannot modify Admin users');
    }

    await this.assertManageable(user, actor);
    if (actor.role !== UserRole.ADMIN && role && role !== user.role)
      throw new ForbiddenException(
        'Use authorized named roles for role assignment',
      );
    // Hierarchy check for Role update
    if (actor.role === UserRole.STORE_MANAGER && role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Store Managers cannot promote users to Admin',
      );
    }

    if (password) {
      const saltRounds = parseInt(
        this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10',
      );
      user.password = await bcrypt.hash(password, saltRounds);
    }

    const roleChanged = !!role && role !== user.role;
    const permissionsChanged =
      updateUserManagementDto.permissions !== undefined &&
      JSON.stringify([...(user.permissions || [])].sort()) !==
        JSON.stringify([...(updateUserManagementDto.permissions || [])].sort());

    if (role) user.role = role;
    if (roleChanged) user.customRoleId = null;
    Object.assign(user, rest);

    if (roleChanged || permissionsChanged || password) {
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    const savedUser = await this.authRepository.save(user);
    const { password: _, ...result } = savedUser;
    return result;
  }

  private async assertManageable(user: Auth, actor: any) {
    if (actor.role === UserRole.ADMIN) return;
    if (user.role === UserRole.ADMIN)
      throw new ForbiddenException('Owner accounts are protected');
    if (actor.branchScope !== 'tenant' && user.branchId !== actor.branchId)
      throw new ForbiddenException('Home branch only');
    let permissions: string[] = user.permissions ?? [];
    if (user.customRoleId) {
      const [role] = await scopedManager().query(
        'SELECT permissions FROM tenant_custom_role WHERE id=$1',
        [user.customRoleId],
      );
      permissions = role?.permissions ?? ['*'];
    } else if (
      user.role !== UserRole.CUSTOM &&
      user.role !== UserRole.CUSTOMER
    ) {
      const [role] = await scopedManager().query(
        'SELECT permissions FROM role_permission WHERE role=$1',
        [user.role],
      );
      permissions = role?.permissions ??
        DEFAULT_ROLE_PERMISSIONS[user.role] ?? ['*'];
    }
    const granted = expandLegacy(actor.permissions ?? []);
    if (expandLegacy(permissions).some((p) => !granted.includes(p)))
      throw new ForbiddenException('Cannot modify a more privileged account');
  }

  async remove(id: string, actor: any) {
    const user = await this.authRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (actor.role === UserRole.STORE_MANAGER && user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Store Managers cannot delete Admin users');
    }

    await this.assertManageable(user, actor);
    await this.authRepository.remove(user);
    return { message: 'User deleted successfully' };
  }
}
