import { IsString, IsNumber, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentSettingDto {
  @ApiProperty({ example: '09:00', description: 'Opening time in 24h format (HH:mm)' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Time must be in HH:mm format' })
  @IsOptional()
  openingTime?: string;

  @ApiProperty({ example: '18:00', description: 'Closing time in 24h format (HH:mm)' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Time must be in HH:mm format' })
  @IsOptional()
  closingTime?: string;

  @ApiProperty({ example: 30, description: 'Default slot duration in minutes' })
  @IsNumber()
  @IsOptional()
  defaultSlotDuration?: number;

  @ApiProperty({ example: 30, description: 'Advance booking window in days' })
  @IsNumber()
  @IsOptional()
  advanceBookingWindow?: number;
}
