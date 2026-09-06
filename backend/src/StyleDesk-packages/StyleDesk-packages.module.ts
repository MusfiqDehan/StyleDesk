import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StyleDeskPackagesService } from './StyleDesk-packages.service';
import { StyleDeskPackagesController } from './StyleDesk-packages.controller';
import { StyleDeskPackage } from './entities/StyleDesk-package.entity';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    ScopedOrmModule.forFeature([StyleDeskPackage]),
    AppointmentsModule,
  ],
  controllers: [StyleDeskPackagesController],
  providers: [StyleDeskPackagesService],
  exports: [StyleDeskPackagesService],
})
export class StyleDeskPackagesModule {}
