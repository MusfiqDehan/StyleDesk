import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Invoice')
@ApiCookieAuth('accessToken')
@Controller('invoice')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created.' })
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoiceService.create(createInvoiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices with optional filters and pagination' })
  @ApiQuery({ name: 'invoiceNumber', required: false, description: 'Filter by invoice number' })
  @ApiQuery({ name: 'phone', required: false, description: 'Filter by client phone' })
  @ApiQuery({ name: 'staff', required: false, description: 'Filter by staff name' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by exact date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by month (1-12)' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated list of invoices.' })
  findAll(
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('phone') phone?: string,
    @Query('staff') staff?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoiceService.findAll(
      {
        invoiceNumber,
        phone,
        staff,
        date,
        month: month ? parseInt(month, 10) : undefined,
        year: year ? parseInt(year, 10) : undefined,
      },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice details.' })
  @ApiResponse({ status: 404, description: 'Invoice not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoiceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an invoice by UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice updated.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoiceService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invoice by UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice deleted.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoiceService.remove(id);
  }
}
