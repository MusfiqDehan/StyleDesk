import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { Employee } from './entities/employee.entity';
import { Payroll } from '../payroll/entities/payroll.entity';
import { PayrollModule } from '../payroll/payroll.module.js';
import { BiometricModule } from '../biometric/biometric.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([Employee, Payroll]),
    forwardRef(() => PayrollModule),
    forwardRef(() => BiometricModule),
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService, ScopedOrmModule],
})
export class EmployeeModule {}
