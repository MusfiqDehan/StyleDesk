import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinanceCategoryService } from './finance-category.service.js';
import { CreateFinanceCategoryDto } from './dto/create-finance-category.dto.js';
import { UpdateFinanceCategoryDto } from './dto/update-finance-category.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Finance Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
@Permissions('invoice')
@Controller('finance/categories')
export class FinanceCategoryController {
  constructor(private readonly categoryService: FinanceCategoryService) {}

  @Get('active')
  @ApiOperation({ summary: 'List active categories for voucher/finance pickers' })
  findActive(@Query('type') type?: string) {
    return this.categoryService.findActive(type);
  }

  @Get()
  @ApiOperation({ summary: 'Paginated finance categories' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '15',
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.categoryService.findAll({
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(50, Math.max(1, Number(limit) || 15)),
      search,
      type,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFinanceCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFinanceCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
