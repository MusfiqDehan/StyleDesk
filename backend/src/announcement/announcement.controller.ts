import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';

@ApiTags('Announcements')
@ApiCookieAuth('accessToken')
@Controller('announcement')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @UseGuards(PermissionsGuard)
  @Permissions('announcement')
  @ApiOperation({ summary: 'Create a new announcement' })
  @ApiResponse({ status: 201, description: 'Announcement created.' })
  create(@Body() dto: CreateAnnouncementDto) {
    return this.announcementService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all announcements' })
  @ApiResponse({ status: 200, description: 'List of announcements.' })
  findAll() {
    return this.announcementService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an announcement by ID' })
  @ApiResponse({ status: 200, description: 'Announcement found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.announcementService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @UseGuards(PermissionsGuard)
  @Permissions('announcement')
  @ApiOperation({ summary: 'Update an announcement' })
  @ApiResponse({ status: 200, description: 'Announcement updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @UseGuards(PermissionsGuard)
  @Permissions('announcement')
  @ApiOperation({ summary: 'Delete an announcement' })
  @ApiResponse({ status: 200, description: 'Announcement deleted.' })
  remove(@Param('id') id: string) {
    return this.announcementService.remove(id);
  }
}
