import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { DeviceConfigService } from './device-config.service';
import { UpdateDeviceConfigDto } from './dto/update-device-config.dto';

@ApiTags('Device Config')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('settings')
@Controller('device-config')
export class DeviceConfigController {
  constructor(private readonly service: DeviceConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get current stored config + live device status' })
  getStatus() {
    return this.service.getFullStatus();
  }

  @Put()
  @ApiOperation({
    summary:
      'Save IP/port to DB and reconnect server to device — does not modify the physical device',
  })
  saveAndApply(@Body() dto: UpdateDeviceConfigDto) {
    return this.service.saveAndApply(dto);
  }

  @Post('auto-sync')
  @ApiOperation({
    summary:
      'Detect server gateway/DNS, update DB if changed — does not modify the physical device',
  })
  autoSync() {
    return this.service.autoSync();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get device config change log (newest first)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLogs(@Query('limit') limit?: string) {
    return this.service.getLogs(limit ? Number(limit) : 30);
  }
}
