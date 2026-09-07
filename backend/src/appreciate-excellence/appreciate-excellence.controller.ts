import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { AppreciateExcellenceService } from './appreciate-excellence.service';
import { CreateAppreciateExcellenceDto } from './dto/create-appreciate-excellence.dto';
import { UpdateAppreciateExcellenceDto } from './dto/update-appreciate-excellence.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';

@ApiTags('Appreciate Excellence')
@ApiCookieAuth('accessToken')
@Controller('appreciate-excellence')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AppreciateExcellenceController {
  constructor(private readonly appreciateExcellenceService: AppreciateExcellenceService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('appreciateExcellence')
  @ApiOperation({ summary: 'Create or Update appreciate excellence record (Admin/StoreManager/Custom only)' })
  @UseInterceptors(FileInterceptor('video', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
  }))
  upsert(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAppreciateExcellenceDto
  ) {
    return this.appreciateExcellenceService.upsert(dto, file);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get appreciate excellence record (Public)' })
  findSingle() {
    return this.appreciateExcellenceService.findSingle();
  }
}
