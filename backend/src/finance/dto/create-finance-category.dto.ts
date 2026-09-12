import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FinanceCategoryStatus,
  FinanceCategoryType,
} from '../entities/finance-category.entity.js';

export class CreateFinanceCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(FinanceCategoryType)
  type: FinanceCategoryType;

  @IsOptional()
  @IsEnum(FinanceCategoryStatus)
  status?: FinanceCategoryStatus;
}
