import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InventoryService } from './inventory.service.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Inventory')
@ApiCookieAuth('accessToken')
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new inventory item' })
  @ApiResponse({ status: 201, description: 'Inventory item created.' })
  create(@Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(createInventoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'List inventory items with optional name filter and pagination' })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by item name (case-insensitive)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sortStock', required: false, enum: ['asc', 'desc'], description: 'Sort by stock quantity: asc (low to high) or desc (high to low)' })
  @ApiResponse({ status: 200, description: 'Paginated list of inventory items.' })
  findAll(
    @Query('name') name?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortStock') sortStock?: 'asc' | 'desc',
  ) {
    return this.inventoryService.findAll(
      { name },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      sortStock,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an inventory item by UUID' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Inventory item details.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an inventory item by UUID' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Inventory item updated.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateInventoryDto: UpdateInventoryDto) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an inventory item by UUID' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Inventory item deleted.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.remove(id);
  }
}
