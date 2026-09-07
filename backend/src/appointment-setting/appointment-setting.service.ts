import { Injectable } from '@nestjs/common';
import { CreateAppointmentSettingDto } from './dto/create-appointment-setting.dto.js';
import { UpdateAppointmentSettingDto } from './dto/update-appointment-setting.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { AppointmentSetting } from './entities/appointment-setting.entity.js';
import { Repository } from 'typeorm';

@Injectable()
export class AppointmentSettingService {
  constructor(
    @InjectRepository(AppointmentSetting)
    private readonly repository: Repository<AppointmentSetting>,
  ) {}

  async upsert(updateDto: UpdateAppointmentSettingDto) {
    let settings = await this.repository.findOne({ where: {} });

    if (!settings) {
      settings = this.repository.create(updateDto);
    } else {
      Object.assign(settings, updateDto);
    }

    return await this.repository.save(settings);
  }

  async findOne() {
    let settings = await this.repository.findOne({ where: {} });
    if (!settings) {
      // Return default settings if none exist yet
      return {
        openingTime: '09:00',
        closingTime: '21:00',
        defaultSlotDuration: 30,
        advanceBookingWindow: 30,
      };
    }
    return settings;
  }
}
