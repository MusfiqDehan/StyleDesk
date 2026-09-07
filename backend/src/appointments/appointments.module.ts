import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentsController } from './appointments.controller.js';
import { Appointment } from './entities/appointment.entity.js';
import { StyleDeskPackage } from '../StyleDesk-packages/entities/StyleDesk-package.entity.js';
import { ClientsModule } from '../clients/clients.module.js';
import { InvoiceModule } from '../invoice/invoice.module.js';
import { ServiceModule } from '../service/service.module.js';
import { EmployeeModule } from '../employee/employee.module.js';
import { PayrollModule } from '../payroll/payroll.module.js';
import { AppointmentSettingModule } from '../appointment-setting/appointment-setting.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { InvoiceSettingModule } from '../invoice-setting/invoice-setting.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([Appointment, StyleDeskPackage]),
    ClientsModule,
    InvoiceModule,
    ServiceModule,
    EmployeeModule,
    PayrollModule,
    AppointmentSettingModule,
    NotificationModule,
    InvoiceSettingModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService, ScopedOrmModule],
})
export class AppointmentsModule {}
