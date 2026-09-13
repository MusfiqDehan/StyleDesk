import { Injectable } from '@nestjs/common';
import { CreateInvoiceSettingDto } from './dto/create-invoice-setting.dto.js';
import { UpdateInvoiceSettingDto } from './dto/update-invoice-setting.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceSetting } from './entities/invoice-setting.entity.js';
import { Repository } from 'typeorm';

@Injectable()
export class InvoiceSettingService {
  constructor(
    @InjectRepository(InvoiceSetting)
    private readonly repository: Repository<InvoiceSetting>,
  ) {}

  async upsert(updateDto: UpdateInvoiceSettingDto) {
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
      return {
        defaultCurrency: 'BDT',
        taxRate: 0,
      };
    }
    return settings;
  }
}
