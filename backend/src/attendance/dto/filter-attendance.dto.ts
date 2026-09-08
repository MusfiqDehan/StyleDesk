import { IsOptional, IsString, Matches, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterAttendanceDto {
  @ApiPropertyOptional({ description: 'Filter by specific date (YYYY-MM-DD)', example: '2026-04-26' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: 'Filter by month (1-12)', example: '4' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ description: 'Filter by year (YYYY)', example: '2026' })
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional({ description: 'Filter by employee UUID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by device serial number (SN)' })
  @IsOptional()
  @IsString()
  deviceSerial?: string;
}
