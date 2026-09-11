import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { DeviceDiscoveryService } from './device-discovery.service';
import { OverrideIpDto } from './dto/override-ip.dto';

@ApiTags('Device Discovery')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('settings')
@Controller('device-discovery')
export class DeviceDiscoveryController {
  constructor(private readonly service: DeviceDiscoveryService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Current discovery state: discovered IP, scan status, watchdog, connection',
  })
  getStatus() {
    return this.service.getStatus();
  }

  @Post('scan')
  @ApiOperation({ summary: 'Trigger an immediate network scan for the ZKTeco device' })
  triggerRescan() {
    return this.service.triggerRescan();
  }

  @Post('override')
  @ApiOperation({
    summary: 'Set a static private/LAN IP — skips auto-discovery and reconnects immediately',
  })
  setOverride(@Body() dto: OverrideIpDto) {
    return this.service.setManualOverride(dto.ip);
  }

  @Delete('override')
  @ApiOperation({ summary: 'Clear the static IP override — next scan will use auto-discovery' })
  clearOverride() {
    return this.service.clearManualOverride();
  }
}
