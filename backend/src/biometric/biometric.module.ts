import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceUser } from './entities/device-user.entity';
import { Employee } from '../employee/entities/employee.entity';
import { ZKTecoService } from './zkteco.service';
import { DeviceUserService } from './device-user.service';
import { BiometricGateway } from './biometric.gateway';
import { DeviceUserController } from './device-user.controller';
import { AdmsCommandQueue } from './adms-command.queue';

@Module({
  imports: [ScopedOrmModule.forFeature([DeviceUser, Employee])],
  controllers: [DeviceUserController],
  providers: [ZKTecoService, DeviceUserService, BiometricGateway, AdmsCommandQueue],
  exports: [DeviceUserService, ZKTecoService, BiometricGateway, AdmsCommandQueue],
})
export class BiometricModule { }
