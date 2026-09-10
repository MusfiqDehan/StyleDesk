import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { DashboardChartsService } from './dashboard-charts.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { DashboardChartRangeDto } from './dto/dashboard-chart-range.dto.js';
import { DashboardChartRange } from './dashboard-chart.types.js';

// This aggregates business-wide revenue, client, and staff data — it was previously
// gated only by JwtAuthGuard, so any authenticated CUSTOMER account could read it.
@ApiTags('Dashboard')
@ApiCookieAuth('accessToken')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
@Permissions('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardChartsService: DashboardChartsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get aggregated dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard stats returned.' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('charts/revenue')
  @ApiOperation({
    summary: 'Revenue trend for a selected range',
    description:
      'Returns collected invoice revenue (Paid + Partial paid amounts) bucketed by day (week/month) or month (6m/year) in Asia/Dhaka.',
  })
  @ApiQuery({ name: 'range', enum: DashboardChartRange, required: true })
  @ApiResponse({ status: 200, description: 'Revenue chart series returned.' })
  getRevenueChart(@Query() query: DashboardChartRangeDto) {
    return this.dashboardChartsService.getRevenueTrend(query.range);
  }

  @Get('charts/appointments')
  @ApiOperation({
    summary: 'Appointment trend for a selected range',
    description:
      'Counts appointments by scheduled business date, bucketed by day (week/month) or month (6m/year).',
  })
  @ApiQuery({ name: 'range', enum: DashboardChartRange, required: true })
  @ApiResponse({ status: 200, description: 'Appointment chart series returned.' })
  getAppointmentsChart(@Query() query: DashboardChartRangeDto) {
    return this.dashboardChartsService.getAppointmentTrend(query.range);
  }

  @Get('charts/top-services')
  @ApiOperation({
    summary: 'Top booked services for a selected range',
    description:
      'Ranks services from appointments in the requested window (not limited to the current calendar month).',
  })
  @ApiQuery({ name: 'range', enum: DashboardChartRange, required: true })
  @ApiResponse({ status: 200, description: 'Top services for the range returned.' })
  getTopServicesChart(@Query() query: DashboardChartRangeDto) {
    return this.dashboardChartsService.getTopServices(query.range);
  }

  @Get('charts/finance')
  @ApiOperation({
    summary: 'Income vs expense and paid vs due trends',
    description:
      'Income combines collected invoices and manual finance income; expense combines manual finance expenses and paid payroll. Paid/due reflect invoice settlement within each bucket.',
  })
  @ApiQuery({ name: 'range', enum: DashboardChartRange, required: true })
  @ApiResponse({ status: 200, description: 'Finance chart series returned.' })
  getFinanceChart(@Query() query: DashboardChartRangeDto) {
    return this.dashboardChartsService.getFinanceTrend(query.range);
  }
}

@Controller('manager-dashboard')
export class ManagerDashboardController extends DashboardController {}
