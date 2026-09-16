import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InvoiceService } from '../invoice/invoice.service.js';
import { CreateInvoiceDto } from '../invoice/dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from '../invoice/dto/update-invoice.dto.js';
@Controller('pos/invoices')
export class PosController {
  constructor(private invoice: InvoiceService) {}
  @Get() list(@Query() q: any) {
    return this.invoice.findAll(q, Number(q.page ?? 1), Number(q.limit ?? 20));
  }
  @Get(':id') one(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoice.findOne(id);
  }
  @Post() create(@Body() b: CreateInvoiceDto) {
    return this.invoice.create(b);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateInvoiceDto,
  ) {
    return this.invoice.update(id, b);
  }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoice.remove(id);
  }
}
