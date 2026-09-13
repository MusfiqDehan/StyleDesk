import { Module } from '@nestjs/common';
import { BiometricModule } from '../biometric/biometric.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { IclockAuthGuard } from './iclock-auth.guard';
import { IclockController } from './iclock.controller';
import { IclockService } from './iclock.service';

@Module({
    imports: [BiometricModule, AttendanceModule],
    controllers: [IclockController],
    providers: [IclockService, IclockAuthGuard],
})
export class IclockModule { }
