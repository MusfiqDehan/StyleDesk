import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EmployeeService } from './employee.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { QuickCreateEmployeeDto } from './dto/quick-create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeeRole, EmployeeStatus } from './entities/employee.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Employees')
@ApiCookieAuth('accessToken')
@Controller('employee')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
@Permissions('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created.' })
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      cb(null, /image\/(jpeg|png|webp)/.test(file.mimetype));
    },
  }))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body('data') data: string,
  ) {
    if (!data) throw new BadRequestException('Employee data is required');
    const createEmployeeDto: CreateEmployeeDto = JSON.parse(data);
    if (!createEmployeeDto.name) throw new BadRequestException('Employee name is required');
    if (!createEmployeeDto.phone) throw new BadRequestException('Employee phone is required');
    if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(createEmployeeDto.phone.replace(/[\s-]/g, ''))) {
      throw new BadRequestException('Phone must be a valid Bangladeshi phone number');
    }
    return this.employeeService.create(createEmployeeDto, file);
  }

  @Post('quick-create')
  @ApiOperation({ summary: 'Quickly create employee from biometric registration (minimal fields)' })
  @ApiResponse({ status: 201, description: 'Employee created.' })
  quickCreate(@Body() dto: QuickCreateEmployeeDto) {
    const createDto: CreateEmployeeDto = {
      name: dto.name,
      phone: dto.phone,
      role: dto.role || EmployeeRole.OTHER,
      status: dto.status || EmployeeStatus.ACTIVE,
    };
    return this.employeeService.create(createDto, undefined);
  }

  @Get()
  @ApiOperation({ summary: 'Get all employees' })
  @ApiQuery({ name: 'name', required: false, description: 'Search by employee name (case-insensitive)' })
  @ApiResponse({ status: 200, description: 'List of all employees.' })
  findAll(@Query('name') name?: string) {
    return this.employeeService.findAll(name);
  }

  @Public()
  @Get('basic')
  @ApiOperation({ summary: 'Get basic employee info (public)' })
  @ApiQuery({ name: 'id', required: false, description: 'Filter by employee ID' })
  @ApiResponse({ status: 200, description: 'Basic employee list.' })
  findBasic(@Query('id') id?: string) {
    return this.employeeService.findBasic(id);
  }

  @Get('stylists')
  @ApiOperation({ summary: 'Get all artists' })
  @ApiResponse({ status: 200, description: 'List of artists.' })
  findStylists() {
    return this.employeeService.findStylists();
  }

  @Get('assistants')
  @ApiOperation({ summary: 'Get all assistants' })
  @ApiResponse({ status: 200, description: 'List of assistants.' })
  findAssistants() {
    return this.employeeService.findAssistants();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee details.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  findOne(@Param('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee updated.' })
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      cb(null, /image\/(jpeg|png|webp)/.test(file.mimetype));
    },
  }))
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('data') data: string,
  ) {
    const updateEmployeeDto: UpdateEmployeeDto = data ? JSON.parse(data) : {};
    if (Object.keys(updateEmployeeDto).length === 0) throw new BadRequestException('Update data is required');
    if (updateEmployeeDto.phone && !/^(?:\+?88)?01[3-9]\d{8}$/.test(updateEmployeeDto.phone.replace(/[\s-]/g, ''))) {
      throw new BadRequestException('Phone must be a valid Bangladeshi phone number');
    }
    return this.employeeService.update(id, updateEmployeeDto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee deleted.' })
  remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }
}
