import { Controller, Get, Put, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { BeginYourJourneyService } from './begin-your-journey.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Begin Your Journey')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('begin-your-journey')
export class BeginYourJourneyController {
  constructor(private readonly beginYourJourneyService: BeginYourJourneyService) {}

  @Put()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('beginYourJourney')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or Update Begin Your Journey background image (Admin/StoreManager/Custom only)' })
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }))
  upsert(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.beginYourJourneyService.upsert(file);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get Begin Your Journey image (Public)' })
  findSingle() {
    return this.beginYourJourneyService.findSingle();
  }
}
