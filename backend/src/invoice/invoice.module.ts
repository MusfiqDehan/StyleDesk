import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { Invoice } from './entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { StyleDeskPackage } from '../StyleDesk-packages/entities/StyleDesk-package.entity';
import { ServiceModule } from '../service/service.module';
import { EmployeeModule } from '../employee/employee.module';
import { InvoiceSettingModule } from '../invoice-setting/invoice-setting.module.js';
import { PayrollModule } from '../payroll/payroll.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([Invoice, Appointment, StyleDeskPackage]),
    ServiceModule,
    EmployeeModule,
    InvoiceSettingModule,
    PayrollModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService, ScopedOrmModule],
})
export class InvoiceModule { }
