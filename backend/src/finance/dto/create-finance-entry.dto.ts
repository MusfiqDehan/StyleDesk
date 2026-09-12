import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FinanceEntryType } from '../entities/finance-entry.entity.js';

export class CreateFinanceEntryDto {
  @IsEnum(FinanceEntryType)
  type: FinanceEntryType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  /** YYYY-MM-DD */
  @IsString()
  @IsNotEmpty()
  date: string;
}
