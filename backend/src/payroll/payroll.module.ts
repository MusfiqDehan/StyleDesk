import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollService } from './payroll.service.js';
import { PayrollController } from './payroll.controller.js';
import { Payroll } from './entities/payroll.entity.js';
import { Employee } from '../employee/entities/employee.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceModule } from '../finance/finance.module.js';

@Module({
  imports: [ScopedOrmModule.forFeature([Payroll, Employee]), AuthModule, FinanceModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule { }
