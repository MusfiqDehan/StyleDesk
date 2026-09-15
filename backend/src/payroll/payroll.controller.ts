import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service.js';
import { CreatePayrollDto } from './dto/create-payroll.dto.js';
import { UpdatePayrollDto } from './dto/update-payroll.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
@Permissions('hr-payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  findAll(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.payrollService.findAll(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
      parseInt(page),
      parseInt(limit),
      search,
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePayrollDto) {
    return this.payrollService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayrollDto) {
    return this.payrollService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.payrollService.remove(id);
  }

  @Post('test-automation')
  async testAutomation(@Query('force') force: string) {
    await this.payrollService.handleAutoPayrollGeneration(force === 'true');
    return { message: 'Automation triggered successfully' };
  }
}
