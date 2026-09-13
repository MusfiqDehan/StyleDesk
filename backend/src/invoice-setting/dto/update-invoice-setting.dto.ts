import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceSettingDto } from './create-invoice-setting.dto.js';

export class UpdateInvoiceSettingDto extends PartialType(CreateInvoiceSettingDto) {}
