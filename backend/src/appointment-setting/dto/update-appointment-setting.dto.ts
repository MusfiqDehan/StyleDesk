import { PartialType } from '@nestjs/swagger';
import { CreateAppointmentSettingDto } from './create-appointment-setting.dto.js';

export class UpdateAppointmentSettingDto extends PartialType(CreateAppointmentSettingDto) {}
