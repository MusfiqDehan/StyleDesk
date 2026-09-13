import { IsString, IsOptional, IsArray, IsNumber, IsEnum, IsDateString, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceStatus } from '../entities/invoice.entity';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ example: 'client-uuid-here', description: 'Client UUID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 'appointment-uuid-here', description: 'Appointment UUID this invoice was generated from' })
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiPropertyOptional({ example: ['Haircut', 'Facial'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional({ example: ['Bridal Glow Package'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  packageNames?: string[];

  @ApiPropertyOptional({ example: 'offline', description: 'online | offline' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'Riya' })
  @IsOptional()
  @IsString()
  staff?: string;

  @ApiPropertyOptional({ example: 'Mim' })
  @IsOptional()
  @IsString()
  assistant?: string;

  @ApiPropertyOptional({ example: 'Admin' })
  @IsOptional()
  @IsString()
  printBy?: string;

  @ApiPropertyOptional({ example: 1500, description: 'Total amount in BDT' })
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiPropertyOptional({ example: 500, description: 'Amount paid so far (for partial payments)' })
  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: '2026-04-19T12:30:00.000Z', description: 'When the appointment was confirmed' })
  @IsOptional()
  @IsDateString()
  confirmedAt?: string;

  @ApiPropertyOptional({ example: true, description: 'If true, apply service commission to the stylist payroll bonus' })
  @IsOptional()
  @IsBoolean()
  applyCommission?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, skip settings tax — total is already final (e.g. confirm booking with custom tax/discount)',
  })
  @IsOptional()
  @IsBoolean()
  skipTax?: boolean;

  @ApiPropertyOptional({
    example: 9,
    description: 'Tax % snapshot at invoice creation — frozen; settings changes do not alter this',
  })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Discount amount (currency, not %) applied at checkout — frozen on the invoice',
  })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({
    example: 5000,
    description:
      'Amount of the customer’s prior outstanding due collected on this invoice (POS Due Collection). Must not exceed current outstanding.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dueCollected?: number;

  @ApiPropertyOptional({
    example: 12000,
    description: 'Optional snapshot of customer outstanding due when collection was added',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priorDueSnapshot?: number;
}
