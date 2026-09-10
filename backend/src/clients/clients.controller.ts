import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Public } from '../auth/public.decorator.js';

@ApiTags('Clients')
@ApiCookieAuth('accessToken')
@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) { }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client created.' })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @ApiOperation({ summary: 'List clients with optional filters and pagination' })
  @ApiQuery({ name: 'time', required: false, description: 'Filter by visit time' })
  @ApiQuery({ name: 'phone', required: false, description: 'Filter by phone number' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated list of clients.' })
  findAll(
    @Query('time') time?: string,
    @Query('phone') phone?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.clientsService.findAll(
      { time, phone },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('history/:id')
  findHistory(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Get(':phone')
  @ApiOperation({ summary: 'Get a client by phone number' })
  @ApiParam({ name: 'phone', description: 'Bangladeshi phone number' })
  @ApiResponse({ status: 200, description: 'Client details.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  findOne(@Param('phone') phone: string) {
    return this.clientsService.findOne(phone);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client by ID' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client updated.' })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a client by ID' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client deleted.' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
