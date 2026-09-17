import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ServiceService } from './service.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { ServiceCategory } from './entities/service.entity.js';
import { uploadLocalImage } from '../common/multer.js';

@ApiTags('Services')
@ApiCookieAuth('accessToken')
@Controller('service')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) { }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      cb(null, /image\/(jpeg|png|webp)/.test(file.mimetype))
    },
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const imageUrl = await uploadLocalImage(file.buffer, 'StyleDesk/services');
    return { imageUrl };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created.' })
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
  }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('data') data: string,
  ) {
    if (!data) throw new BadRequestException('Service data is required');
    const createServiceDto: CreateServiceDto = typeof data === 'string' ? JSON.parse(data) : data;
    return this.serviceService.create(createServiceDto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all services' })
  @ApiQuery({ name: 'name', required: false, description: 'Search by service name (case-insensitive)' })
  @ApiQuery({ name: 'category', required: false, enum: ServiceCategory, description: 'Filter by category (case-insensitive)' })
  @ApiQuery({ name: 'sortPrice', required: false, enum: ['asc', 'desc'], description: 'Sort by price: asc (low to high) or desc (high to low)' })
  @ApiResponse({ status: 200, description: 'List of all services.' })
  findAll(
    @Query('name') name?: string,
    @Query('category') category?: ServiceCategory,
    @Query('sortPrice') sortPrice?: 'asc' | 'desc',
  ) {
    return this.serviceService.findAll(name, category, sortPrice);
  }

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get active services (public)' })
  @ApiQuery({ name: 'name', required: false, description: 'Search by service name (case-insensitive)' })
  @ApiQuery({ name: 'category', required: false, enum: ServiceCategory, description: 'Filter by category (case-insensitive)' })
  @ApiQuery({ name: 'sortPrice', required: false, enum: ['asc', 'desc'], description: 'Sort by price: asc (low to high) or desc (high to low)' })
  @ApiResponse({ status: 200, description: 'List of active services.' })
  findActive(
    @Query('name') name?: string,
    @Query('category') category?: ServiceCategory,
    @Query('sortPrice') sortPrice?: 'asc' | 'desc',
  ) {
    return this.serviceService.findActive(name, category, sortPrice);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a service by UUID' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service details.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service by UUID' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service updated.' })
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
  }))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('data') data: string,
  ) {
    if (!data) throw new BadRequestException('Service data is required');
    const updateServiceDto: UpdateServiceDto = typeof data === 'string' ? JSON.parse(data) : data;
    return this.serviceService.update(id, updateServiceDto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service by UUID' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service deleted.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceService.remove(id);
  }
}
