import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class UpdateAttendanceDto {
  @ApiPropertyOptional({ example: '2025-04-27T09:00:00+06:00' })
  @IsOptional()
  @IsISO8601()
  checkInTime?: string;

  @ApiPropertyOptional({ example: '2025-04-27T17:00:00+06:00', nullable: true })
  @IsOptional()
  @IsISO8601()
  checkOutTime?: string | null;

  @ApiPropertyOptional({ enum: AttendanceStatus, nullable: true })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus | null;
}
