import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FinanceService } from './finance.service.js';
import { FinanceCategoryService } from './finance-category.service.js';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto.js';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto.js';
@Controller('vouchers')
export class VoucherController {
  constructor(
    private finance: FinanceService,
    private categories: FinanceCategoryService,
  ) {}
  @Get('categories') options(@Query('type') type?: string) {
    return this.categories.findActive(type);
  }
  @Get() list(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.finance.findAll(
      Math.max(1, Number(page) || 1),
      Math.min(200, Math.max(1, Number(limit) || 50)),
    );
  }
  @Post() create(@Body() b: CreateFinanceEntryDto) {
    return this.finance.create(b);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateFinanceEntryDto,
  ) {
    return this.finance.update(id, b);
  }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.remove(id);
  }
}
