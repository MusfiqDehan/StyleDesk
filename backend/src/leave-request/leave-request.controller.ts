import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Leave Requests')
@ApiCookieAuth('accessToken')
@Controller('leave-request')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new leave request' })
  @ApiResponse({ status: 201, description: 'Leave request created.' })
  create(@Body() dto: CreateLeaveRequestDto, @Req() req: any) {
    return this.leaveRequestService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leave requests' })
  @ApiResponse({ status: 200, description: 'List of leave requests.' })
  findAll(@Req() request: any) {
    return this.leaveRequestService.findAll(request.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a leave request by ID' })
  @ApiResponse({ status: 200, description: 'Leave request found.' })
  @ApiResponse({ status: 403, description: 'Not your leave request.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string, @Req() req: any) {
    // Ownership/role check lives in the service — any authenticated role could
    // otherwise fetch any other employee's leave request by guessing its id.
    return this.leaveRequestService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @UseGuards(PermissionsGuard)
  @Permissions('leave-request')
  @ApiOperation({ summary: 'Update a leave request' })
  @ApiResponse({ status: 200, description: 'Leave request updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateLeaveRequestDto) {
    return this.leaveRequestService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @UseGuards(PermissionsGuard)
  @Permissions('leave-request')
  @ApiOperation({ summary: 'Delete a leave request' })
  @ApiResponse({ status: 200, description: 'Leave request deleted.' })
  remove(@Param('id') id: string) {
    return this.leaveRequestService.remove(id);
  }
}
