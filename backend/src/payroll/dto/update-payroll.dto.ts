import { PartialType } from '@nestjs/mapped-types';
import { CreatePayrollDto } from './create-payroll.dto.js';

export class UpdatePayrollDto extends PartialType(CreatePayrollDto) {}
