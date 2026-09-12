import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import {VoucherController} from './voucher.controller.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceService } from './finance.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceCategoryService } from './finance-category.service.js';
import { FinanceCategoryController } from './finance-category.controller.js';
import { FinanceEntry } from './entities/finance-entry.entity.js';
import { FinanceCategory } from './entities/finance-category.entity.js';
import { Invoice } from '../invoice/entities/invoice.entity.js';
import { Payroll } from '../payroll/entities/payroll.entity.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([FinanceEntry, FinanceCategory, Invoice, Payroll]),
    AuthModule,
  ],
  controllers: [FinanceController, FinanceCategoryController,VoucherController],
  providers: [FinanceService, FinanceCategoryService],
  exports: [FinanceService, FinanceCategoryService],
})
export class FinanceModule {}
// finance categories CRUD wired via FinanceCategoryController
