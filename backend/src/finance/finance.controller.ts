import {FinanceCategoryService} from './finance-category.service.js';
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
import { FinanceService, type FinanceTrendRange, type FinanceTransactionType } from './finance.service.js';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto.js';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
@Permissions('invoice')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService,private readonly categories:FinanceCategoryService) {}

  @Get('category-options') options(@Query('type')type?:string){return this.categories.findActive(type);}
  @Get('overview')
  @ApiOperation({ summary: 'Year-scoped finance KPI totals' })
  getOverview(@Query('year') year?: string) {
    const y = year ? Number(year) : undefined;
    return this.financeService.getOverview(y);
  }

  @Get('monthly-summary')
  @ApiOperation({ summary: 'Yearly income/expense summary by category' })
  getMonthlySummary(@Query('year') year?: string) {
    const y = year ? Number(year) : undefined;
    return this.financeService.getMonthlySummary(y);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Searchable finance transactions' })
  getTransactions(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const allowed: FinanceTransactionType[] = ['all', 'income', 'expense'];
    const resolvedType = allowed.includes(type as FinanceTransactionType)
      ? (type as FinanceTransactionType)
      : 'all';
    return this.financeService.getTransactions({
      search,
      type: resolvedType,
      from,
      to,
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 20)),
    });
  }

  @Get('trend')
  @ApiOperation({ summary: 'Monthly income vs expense trend' })
  getTrend(@Query('range') range?: string, @Query('year') year?: string) {
    const allowed: FinanceTrendRange[] = [
      'this_year',
      'last_6_months',
      'last_3_months',
      'this_month',
    ];
    const resolved = allowed.includes(range as FinanceTrendRange)
      ? (range as FinanceTrendRange)
      : 'this_year';
    const y = year ? Number(year) : undefined;
    return this.financeService.getTrend(resolved, y);
  }

  @Get()
  @ApiOperation({ summary: 'List finance ledger entries' })
  findAll(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.financeService.findAll(
      Math.max(1, Number(page) || 1),
      Math.min(200, Math.max(1, Number(limit) || 50)),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create income or expense entry' })
  create(@Body() dto: CreateFinanceEntryDto) {
    return this.financeService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFinanceEntryDto) {
    return this.financeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.financeService.remove(id);
  }
}
