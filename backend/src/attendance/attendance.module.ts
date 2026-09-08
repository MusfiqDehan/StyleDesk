import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceLogService } from './attendance-log.service';
import { Attendance } from './entities/attendance.entity';
import { AttendanceLog } from './entities/attendance-log.entity';
import { EmployeeModule } from '../employee/employee.module';
import { Employee } from '../employee/entities/employee.entity';
import { DeviceUser } from '../biometric/entities/device-user.entity';
import { BiometricModule } from '../biometric/biometric.module';
import { BiometricPunchGuard } from './biometric-punch.guard.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([Attendance, AttendanceLog, Employee, DeviceUser]),
    EmployeeModule,
    BiometricModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceLogService, BiometricPunchGuard],
  exports: [AttendanceService, AttendanceLogService],
})
export class AttendanceModule {}
