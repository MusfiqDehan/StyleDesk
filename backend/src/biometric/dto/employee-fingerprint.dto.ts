import { IsUUID } from 'class-validator';

export class EmployeeFingerprintDto {
  @IsUUID()
  employee_id!: string;
}
