import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceSettingDto {
  @ApiProperty({ example: 'BDT', description: 'Default currency code' })
  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @ApiProperty({ example: 15, description: 'Tax rate in percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxRate?: number;
}
