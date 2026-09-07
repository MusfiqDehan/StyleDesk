import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { AppointmentSettingService } from './appointment-setting.service.js';
import { AppointmentSettingController } from './appointment-setting.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentSetting } from './entities/appointment-setting.entity.js';

@Module({
  imports: [ScopedOrmModule.forFeature([AppointmentSetting])],
  controllers: [AppointmentSettingController],
  providers: [AppointmentSettingService],
  exports: [AppointmentSettingService],
})
export class AppointmentSettingModule {}
