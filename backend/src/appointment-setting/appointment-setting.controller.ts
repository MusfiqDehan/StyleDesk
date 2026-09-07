import { Controller, Get, Body, Patch, UseGuards } from '@nestjs/common';
import { AppointmentSettingService } from './appointment-setting.service.js';
import { UpdateAppointmentSettingDto } from './dto/update-appointment-setting.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';

@ApiTags('Appointment Setting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointment-setting')
export class AppointmentSettingController {
  constructor(private readonly appointmentSettingService: AppointmentSettingService) {}

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiOperation({ summary: 'Create or update appointment settings' })
  update(@Body() updateDto: UpdateAppointmentSettingDto) {
    return this.appointmentSettingService.upsert(updateDto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get appointment settings' })
  findOne() {
    return this.appointmentSettingService.findOne();
  }
}
