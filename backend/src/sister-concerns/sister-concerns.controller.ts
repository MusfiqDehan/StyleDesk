import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SisterConcernsService } from './sister-concerns.service.js';
import { UpsertSisterConcernsDto } from './dto/upsert-sister-concerns.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';

@ApiTags('Sister Concerns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sister-concerns')
export class SisterConcernsController {
  constructor(private readonly sisterConcernsService: SisterConcernsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create or update Sister Concerns home section' })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upsert(@UploadedFile() file: Express.Multer.File, @Body() dto: UpsertSisterConcernsDto) {
    return this.sisterConcernsService.upsert(dto, file);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get Sister Concerns section (Public)' })
  findSingle() {
    return this.sisterConcernsService.findSingle();
  }
}
