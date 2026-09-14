import { PartialType } from '@nestjs/swagger';
import { CreateLeaveRequestDto } from './create-leave-request.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { LeaveStatus } from '../entities/leave-request.entity';

export class UpdateLeaveRequestDto extends PartialType(CreateLeaveRequestDto) {
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}
