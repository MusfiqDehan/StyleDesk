import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Reports')
@ApiCookieAuth('accessToken')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get()
  @ApiOperation({ summary: 'Get reports for a date range' })
  @ApiQuery({ name: 'from', example: '2025-01-01' })
  @ApiQuery({ name: 'to', example: '2025-12-31' })
  getReports(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getReports(from, to);
  }

  @Get('staff')
  @ApiOperation({ summary: 'Get staff performance report for a date range' })
  @ApiQuery({ name: 'from', example: '2025-01-01' })
  @ApiQuery({ name: 'to', example: '2025-12-31' })
  getStaffReports(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getStaffReports(from, to);
  }
}
