import { Controller, Get, Body, Patch, UseGuards } from '@nestjs/common';
import { InvoiceSettingService } from './invoice-setting.service.js';
import { UpdateInvoiceSettingDto } from './dto/update-invoice-setting.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Public } from '../auth/public.decorator.js';

@ApiTags('Invoice Setting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoice-setting')
export class InvoiceSettingController {
  constructor(private readonly invoiceSettingService: InvoiceSettingService) {}

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @ApiOperation({ summary: 'Create or update invoice settings' })
  update(@Body() updateDto: UpdateInvoiceSettingDto) {
    return this.invoiceSettingService.upsert(updateDto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get invoice settings' })
  findOne() {
    return this.invoiceSettingService.findOne();
  }
}
