import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsEmail, IsDateString, Matches, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeRole, EmployeeStatus, EmploymentType } from '../entities/employee.entity';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Riya Akter' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: EmployeeRole })
  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole;

  @ApiPropertyOptional({ example: 'CEO' })
  @IsOptional()
  @IsString()
  customRole?: string;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, { message: 'phone must be a valid Bangladeshi phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'riya@salon.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  salary?: number;

  @ApiPropertyOptional({ example: 10, description: 'Commission percentage' })
  @IsOptional()
  @IsNumber()
  commission?: number;

  @ApiPropertyOptional({ example: 'morning' })
  @IsOptional()
  @IsString()
  shift?: string;

  @ApiPropertyOptional({ example: 3, description: 'Years of experience' })
  @IsOptional()
  @IsNumber()
  experience?: number;

  @ApiPropertyOptional({ example: '2023-01-15' })
  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 'FP-00421', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fingerprintCode?: string;

  @ApiPropertyOptional({ example: ['Hair Cutting', 'Coloring'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional({ example: 'https://cloudinary.com/image.jpg' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 'Experienced hair stylist with a passion for creative coloring.' })
  @IsOptional()
  @IsString()
  about?: string;
}
