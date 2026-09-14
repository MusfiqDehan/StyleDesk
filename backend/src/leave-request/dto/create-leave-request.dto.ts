import { IsString, IsNotEmpty, IsEnum, IsDateString, IsUUID, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '../entities/leave-request.entity';

export class CreateLeaveRequestDto {
  @ApiPropertyOptional({ example: 'uuid-of-employee', description: 'Required only for Admin/StoreManager to submit on behalf of another employee. Staff leave this empty.' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  // employeeName is resolved server-side from the employee record — not sent by the client

  @ApiProperty({ enum: LeaveType, example: LeaveType.CASUAL })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-04-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-04-12' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'Family function to attend' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
