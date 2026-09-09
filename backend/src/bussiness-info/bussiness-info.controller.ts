import { Controller, Get, Body, Patch, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BussinessInfoService } from './bussiness-info.service.js';
import { UpdateBussinessInfoDto } from './dto/update-bussiness-info.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';

@ApiTags('Business Info')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bussiness-info')
export class BussinessInfoController {
  constructor(private readonly bussinessInfoService: BussinessInfoService) {}

  @Post('upload-logo')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiOperation({ summary: 'Upload or replace the business logo' })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      cb(null, /image\/(jpeg|png|webp|svg\+xml)/.test(file.mimetype));
    },
  }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file provided');
    return this.bussinessInfoService.uploadLogo(file.buffer);
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiOperation({ summary: 'Create or update business information' })
  update(@Body() updateBussinessInfoDto: UpdateBussinessInfoDto) {
    return this.bussinessInfoService.createOrUpdate(updateBussinessInfoDto);
  }

  @Patch('contact')
  updateContact(@Body()b:UpdateBussinessInfoDto){const{contactSectionTitle,contactSectionDescription,mapEmbedUrl}=b;return this.bussinessInfoService.createOrUpdate({contactSectionTitle,contactSectionDescription,mapEmbedUrl});}
  @Patch('sort/services')
  sortServices(@Body()b:UpdateBussinessInfoDto){return this.bussinessInfoService.createOrUpdate({servicesSortOrder:b.servicesSortOrder});}
  @Patch('sort/packages')
  sortPackages(@Body()b:UpdateBussinessInfoDto){return this.bussinessInfoService.createOrUpdate({packagesSortOrder:b.packagesSortOrder});}
  @Post('resolve-map-embed')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiOperation({ summary: 'Convert a Google Maps share link into an embeddable iframe URL' })
  resolveMapEmbed(@Body() body: { url: string }) {
    return this.bussinessInfoService.resolveMapEmbedUrl(body.url);
  }

  @Public()
  @Get('site-visibility')
  @ApiOperation({ summary: 'Public flag: whether the main marketing website is hidden' })
  siteVisibility() {
    return this.bussinessInfoService.getSiteVisibility();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get business information' })
  findOne() {
    return this.bussinessInfoService.findOne();
  }
}
