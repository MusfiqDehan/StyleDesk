import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController,ManagerDashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardChartsService } from './dashboard-charts.service.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Invoice } from '../invoice/entities/invoice.entity.js';
import { Client } from '../clients/entities/client.entity.js';
import { Service } from '../service/entities/service.entity.js';
import { Employee } from '../employee/entities/employee.entity.js';
import { Inventory } from '../inventory/entities/inventory.entity.js';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { FinanceEntry } from '../finance/entities/finance-entry.entity.js';
import { Payroll } from '../payroll/entities/payroll.entity.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([
      Appointment,
      Invoice,
      Client,
      Service,
      Employee,
      Inventory,
      Attendance,
      FinanceEntry,
      Payroll,
    ]),
  ],
  controllers: [DashboardController,ManagerDashboardController],
  providers: [DashboardService, DashboardChartsService],
})
export class DashboardModule {}
