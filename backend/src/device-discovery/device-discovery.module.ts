import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BiometricModule } from '../biometric/biometric.module';
import { DeviceNetworkConfig } from '../device-config/entities/device-network-config.entity';
import { DeviceDiscoveryController } from './device-discovery.controller';
import { DeviceDiscoveryService } from './device-discovery.service';

@Module({
  imports: [
    ScopedOrmModule.forFeature([DeviceNetworkConfig]),
    BiometricModule,
  ],
  controllers: [DeviceDiscoveryController],
  providers: [DeviceDiscoveryService],
  exports: [DeviceDiscoveryService],
})
export class DeviceDiscoveryModule {}
