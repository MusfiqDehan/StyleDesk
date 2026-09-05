import { Controller, Get, Req, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisteredDevice } from './entities/device.entity.js';
@Controller('devices')
export class DeviceController {
  constructor(@InjectRepository(RegisteredDevice) private readonly devices: Repository<RegisteredDevice>) {}
  @Get() list(@Req() req: any) {
    if (req.user.role !== 'admin' && req.user.role !== 'storeManager' && !req.user.permissions?.includes('attendance')) throw new ForbiddenException();
    return this.devices.find({ where: { active: true }, select: { id: true, serial: true, branchId: true } });
  }
}
