import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NewsLetterSubscriberService } from './news-letter-subscriber.service.js';
import { CreateNewsLetterSubscriberDto } from './dto/create-news-letter-subscriber.dto.js';
import { UpdateNewsLetterSubscriberDto } from './dto/update-news-letter-subscriber.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Newsletter Subscriber')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('news-letter-subscriber')
export class NewsLetterSubscriberController {
  constructor(private readonly newsLetterSubscriberService: NewsLetterSubscriberService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Subscribe to the newsletter (Public)' })
  create(@Body() createNewsLetterSubscriberDto: CreateNewsLetterSubscriberDto) {
    return this.newsLetterSubscriberService.create(createNewsLetterSubscriberDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('news-letter-subscriber')
  @ApiOperation({ summary: 'Get all newsletter subscribers (Admin/Store Manager/Custom only)' })
  findAll() {
    return this.newsLetterSubscriberService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('news-letter-subscriber')
  @ApiOperation({ summary: 'Get a single newsletter subscriber (Admin/Store Manager/Custom only)' })
  findOne(@Param('id') id: string) {
    return this.newsLetterSubscriberService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('news-letter-subscriber')
  @ApiOperation({ summary: 'Update a newsletter subscriber (Admin/Store Manager/Custom only)' })
  update(@Param('id') id: string, @Body() updateNewsLetterSubscriberDto: UpdateNewsLetterSubscriberDto) {
    return this.newsLetterSubscriberService.update(id, updateNewsLetterSubscriberDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('news-letter-subscriber')
  @ApiOperation({ summary: 'Remove a newsletter subscriber (Admin/Store Manager/Custom only)' })
  remove(@Param('id') id: string) {
    return this.newsLetterSubscriberService.remove(id);
  }
}
