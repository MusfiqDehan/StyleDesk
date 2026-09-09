import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { DeviceUserService } from './device-user.service';
import { LinkDeviceUserDto } from './dto/link-device-user.dto';
import { EmployeeFingerprintDto } from './dto/employee-fingerprint.dto';

@ApiTags('Biometric')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('employee')
@Controller('device-users')
export class DeviceUserController {
  constructor(private readonly service: DeviceUserService) {}

  @Get()
  @ApiOperation({ summary: 'List all device users' })
  findAll() {
    return this.service.findAll();
  }

  @Get('unlinked')
  @ApiOperation({ summary: 'List unlinked device users awaiting employee assignment' })
  findUnlinked() {
    return this.service.findUnlinked();
  }

  @Get('status')
  @ApiOperation({ summary: 'ZKTeco device connection status' })
  deviceStatus() {
    return this.service.deviceStatus();
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually pull users from device and detect new ones' })
  sync() {
    return this.service.syncWithDevice();
  }

  @Post('enroll')
  @ApiOperation({
    summary:
      'Queue ADMS commands so the connected ZKTeco opens fingerprint enrollment for an employee, then auto-link on scan',
  })
  enroll(@Body() dto: EmployeeFingerprintDto) {
    return this.service.startEnrollmentForEmployee(dto.employee_id);
  }

  @Post('remove-fingerprint')
  @ApiOperation({
    summary:
      'Remove fingerprint template from the ZKTeco device and unlink it from the employee (user PIN stays on device)',
  })
  removeFingerprint(@Body() dto: EmployeeFingerprintDto) {
    return this.service.removeFingerprintForEmployee(dto.employee_id);
  }

  @Post('link')
  @ApiOperation({ summary: 'Link a device user to an existing employee' })
  link(@Body() dto: LinkDeviceUserDto) {
    return this.service.linkToEmployee(dto.device_uid, dto.employee_id);
  }

  @Delete(':deviceUid/unlink')
  @ApiOperation({ summary: 'Unlink a device user from its employee' })
  unlink(@Param('deviceUid') deviceUid: string) {
    return this.service.unlinkEmployee(deviceUid);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all unlinked device users from the device and the database' })
  deleteAll() {
    return this.service.deleteAllUnlinkedDeviceUsers();
  }

  @Delete(':deviceUid')
  @ApiOperation({ summary: 'Delete a device user from the device and the database' })
  delete(@Param('deviceUid') deviceUid: string) {
    return this.service.deleteDeviceUser(deviceUid, { requireDeviceDeletion: false });
  }
}
