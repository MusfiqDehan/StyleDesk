import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserManagementService } from './user-management.service.js';
import { CreateUserManagementDto } from './dto/create-user-management.dto.js';
import { UpdateUserManagementDto } from './dto/update-user-management.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('User Management')
@ApiCookieAuth('accessToken')
@Controller('user-management')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.CUSTOM)
@Permissions('user-management')
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new system user (admin/manager only)' })
  @ApiResponse({ status: 201, description: 'User created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(
    @Body() createUserManagementDto: CreateUserManagementDto,
    @Req() req: any,
  ) {
    const creatorRole = req.user.role;
    return this.userManagementService.create(
      createUserManagementDto,
      creatorRole,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CUSTOM)
  @ApiOperation({ summary: 'List all system users' })
  @ApiQuery({ name: 'email', required: false, description: 'Filter by email' })
  @ApiResponse({ status: 200, description: 'List of users.' })
  findAll(@Req() req: any, @Query('email') email?: string) {
    return this.userManagementService.findAll(email, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a system user by UUID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User details.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.userManagementService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a system user by UUID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserManagementDto: UpdateUserManagementDto,
    @Req() req: any,
  ) {
    const requesterRole = req.user;
    return this.userManagementService.update(
      id,
      updateUserManagementDto,
      requesterRole,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a system user by UUID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const requesterRole = req.user;
    return this.userManagementService.remove(id, requesterRole);
  }
}
