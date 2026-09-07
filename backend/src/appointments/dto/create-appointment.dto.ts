import { IsString, IsNotEmpty, IsOptional, IsDateString, IsArray, Matches, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @ApiProperty({ example: '01785720927', description: 'Valid Bangladeshi phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:(?:\+?88)?01[3-9]\d{8}|1[3-9]\d{8})$/, {
    message: 'phoneNumber must be a valid Bangladeshi phone number',
  })
  phoneNumber: string;

  @ApiProperty({ example: 'Jubayer Ahmed' })
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @ApiProperty({ example: '2024-06-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '10:30 AM' })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiPropertyOptional({ example: 'Siam' })
  @IsOptional()
  @IsString()
  staff?: string;

  @ApiPropertyOptional({ example: 'Mim' })
  @IsOptional()
  @IsString()
  assistant?: string;

  @ApiPropertyOptional({ example: 'walk-in', description: 'Booking source' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: ['Hair Color'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional({ example: 'Allergic to certain hair dye' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus, example: AppointmentStatus.PENDING })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isPackage?: boolean;

  @ApiPropertyOptional({ example: 'Bridal Package' })
  @IsOptional()
  @IsString()
  packageName?: string;

  @ApiPropertyOptional({
    example: ['Bridal Package', 'Bridal Package'],
    type: [String],
    description:
      'Selected package titles (repeat an entry for quantity). Preferred over comma-joined packageName for pricing.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  packageNames?: string[];

  @ApiPropertyOptional({ example: true, description: 'Whether commission should be applied to the employee when appointment is completed' })
  @IsOptional()
  applyCommission?: boolean;

  @ApiPropertyOptional({ example: 500, description: 'Advance amount paid' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  advance?: number;

  @ApiPropertyOptional({ example: 100, description: 'Discount amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 400, description: 'Remaining due amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dueAmount?: number;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Estimated booking total (services + packages). Computed server-side if omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({
    example: 1500,
    description:
      'Final invoice total when confirming (tax/discount already applied). Not persisted on the appointment.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  confirmedTotal?: number;

  @ApiPropertyOptional({ example: '10:30', description: 'Actual check-in time (HH:MM)' })
  @IsOptional()
  @IsString()
  inTime?: string;

  @ApiPropertyOptional({ example: '11:45', description: 'Actual check-out time (HH:MM)' })
  @IsOptional()
  @IsString()
  outTime?: string;
}
