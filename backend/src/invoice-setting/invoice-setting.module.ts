import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { InvoiceSettingService } from './invoice-setting.service.js';
import { InvoiceSettingController } from './invoice-setting.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceSetting } from './entities/invoice-setting.entity.js';

@Module({
  imports: [ScopedOrmModule.forFeature([InvoiceSetting])],
  controllers: [InvoiceSettingController],
  providers: [InvoiceSettingService],
  exports: [InvoiceSettingService],
})
export class InvoiceSettingModule {}
