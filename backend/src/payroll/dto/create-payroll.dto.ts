import { IsString, IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { PayrollStatus } from '../entities/payroll.entity.js';

export class CreatePayrollDto {
  @IsString()
  employeeId: string;

  @IsString()
  employeeName: string;

  @IsString()
  role: string;

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bonus?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deductions?: number;

  @IsNumber()
  @Min(0)
  netSalary: number;

  @IsEnum(PayrollStatus)
  @IsOptional()
  status?: PayrollStatus;

  @IsString()
  @IsOptional()
  payDate?: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  year: number;
}
