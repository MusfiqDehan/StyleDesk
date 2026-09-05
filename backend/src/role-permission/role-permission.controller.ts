import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolePermissionService } from './role-permission.service.js';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { ALL_MODULE_PERMISSIONS } from './role-permission.defaults.js';

@ApiTags('Role Permissions')
@ApiCookieAuth('accessToken')
@Controller('role-permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER)
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Get('modules')
  @ApiOperation({ summary: 'List all toggleable module permission keys' })
  listModules() {
    return { modules: ALL_MODULE_PERMISSIONS };
  }

  @Get()
  @ApiOperation({ summary: 'List permission templates for editable roles' })
  findAll() {
    return this.rolePermissionService.findAll();
  }

  @Get(':role')
  @ApiOperation({ summary: 'Get permission template for one role' })
  findOne(@Param('role') role: string) {
    return this.rolePermissionService.findOne(role);
  }

  @Patch(':role')
  @ApiOperation({ summary: 'Update role permissions and invalidate sessions for that role' })
  update(
    @Param('role') role: string,
    @Body() body: UpdateRolePermissionDto,
    @Req() req: { user: { role: UserRole } },
  ) {
    return this.rolePermissionService.updateRolePermissions(
      role,
      body.permissions ?? [],
      req.user.role,
    );
  }
}
