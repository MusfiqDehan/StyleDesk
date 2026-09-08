import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiCookieAuth, ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { AttendanceService } from './attendance.service';
import { AttendanceLogService } from './attendance-log.service';
import { Attendance } from './entities/attendance.entity';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { BiometricPunchGuard } from './biometric-punch.guard.js';

class BiometricPunchDto {
  @ApiProperty({ example: 'FP-00421', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  fingerprintCode: string;

  @ApiProperty({ example: 'MACHINE-01', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  machineId: string;

  @ApiProperty({ example: '2024-06-15T10:30:00Z', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  timestamp: string;
}

@ApiTags('Attendance')
@ApiCookieAuth('accessToken')
@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('attendance')
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly logService: AttendanceLogService,
  ) { }

  @Public()
  @UseGuards(BiometricPunchGuard)
  @Post('biometric/punch')
  @ApiOperation({ summary: 'Record a biometric punch (public webhook, requires shared secret)' })
  punch(@Body() body: BiometricPunchDto): Promise<Attendance> {
    return this.service.punchByFingerprint(
      body.fingerprintCode,
      body.machineId,
      body.timestamp,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get attendance records with optional filters (date/month/year/employeeId)' })
  findFiltered(@Query() filter: FilterAttendanceDto): Promise<Attendance[]> {
    return this.service.findFiltered(filter);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's attendance records" })
  findToday(): Promise<Attendance[]> {
    return this.service.findToday();
  }

  @Get('devices')
  @ApiOperation({ summary: 'List distinct device serial numbers seen in attendance' })
  devices(): Promise<string[]> {
    return this.service.getDeviceSerials();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly attendance summary counts' })
  summary(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = Number(year ?? new Date().getFullYear());
    const m = Number(month ?? new Date().getMonth() + 1);
    return this.service.getMonthSummary(y, m);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually sync attendance logs from device now' })
  syncNow() {
    return this.service.syncFromDevice();
  }

  @Post('reprocess/device/:deviceUid')
  @ApiOperation({ summary: 'Reprocess all stored attendance logs for a device UID (run after linking)' })
  @ApiParam({ name: 'deviceUid', description: 'Device fingerprint UID' })
  reprocessDevice(@Param('deviceUid') deviceUid: string): Promise<void> {
    return this.logService.reprocessForDeviceUser(deviceUid);
  }

  @Post('suppress/device/:deviceUid/date/:date')
  @ApiOperation({ summary: 'Suppress all attendance logs for a device UID on a specific date (popup denial)' })
  @ApiParam({ name: 'deviceUid', description: 'Device fingerprint UID' })
  @ApiParam({ name: 'date', description: 'Business date YYYY-MM-DD' })
  suppressUnlinkedScan(
    @Param('deviceUid') deviceUid: string,
    @Param('date') date: string,
  ): Promise<void> {
    return this.logService.suppressForDeviceOnDate(deviceUid, date);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update check-in/out times or status of an attendance record' })
  @ApiParam({ name: 'id', description: 'Attendance record ID' })
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attendance row by ID' })
  @ApiParam({ name: 'id', description: 'Attendance record ID' })
  @ApiResponse({ status: 200, description: 'Attendance record deleted.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
