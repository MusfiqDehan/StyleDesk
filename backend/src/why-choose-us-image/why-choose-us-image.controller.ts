import { Controller, Get, Patch, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { WhyChooseUsImageService } from './why-choose-us-image.service.js';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Why Choose Us Image')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('why-choose-us-image')
export class WhyChooseUsImageController {
  constructor(private readonly whyChooseUsImageService: WhyChooseUsImageService) {}

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or update specific images for Why Choose Us section' })
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
  ]))
  update(@UploadedFiles() files: { 
    image1?: Express.Multer.File[], 
    image2?: Express.Multer.File[], 
    image3?: Express.Multer.File[], 
    image4?: Express.Multer.File[] 
  }) {
    return this.whyChooseUsImageService.createOrUpdate(files);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get Why Choose Us images' })
  findAll() {
    return this.whyChooseUsImageService.findAll();
  }
}
