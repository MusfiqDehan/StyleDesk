import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Client } from '../clients/entities/client.entity';
import { Employee } from '../employee/entities/employee.entity';

@Module({
  imports: [ScopedOrmModule.forFeature([Invoice, Appointment, Client, Employee])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule { }
