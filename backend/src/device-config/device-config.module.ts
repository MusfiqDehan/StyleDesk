import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BiometricModule } from '../biometric/biometric.module';
import { DeviceConfigController } from './device-config.controller';
import { DeviceConfigService } from './device-config.service';
import { DeviceConfigLog } from './entities/device-config-log.entity';
import { DeviceNetworkConfig } from './entities/device-network-config.entity';

@Module({
  imports: [
    ScopedOrmModule.forFeature([DeviceNetworkConfig, DeviceConfigLog]),
    BiometricModule,
  ],
  controllers: [DeviceConfigController],
  providers: [DeviceConfigService],
  exports: [DeviceConfigService],
})
export class DeviceConfigModule {}
