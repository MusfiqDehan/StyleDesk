import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Client } from './entities/client.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

@Module({
  imports: [ScopedOrmModule.forFeature([Client, Invoice, Appointment])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ScopedOrmModule, ClientsService],
})
export class ClientsModule {}
