import { IsString, IsNotEmpty, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeRole, EmployeeStatus } from '../entities/employee.entity';

/**
 * DTO for quick employee creation from biometric registration.
 * Minimal validation - phone doesn't need strict Bangladeshi format.
 */
export class QuickCreateEmployeeDto {
    @ApiProperty({ example: 'Riya Akter' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: '01712345678' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, { message: 'Phone must be a valid Bangladeshi phone number' })
    phone: string;

    @ApiPropertyOptional({ enum: EmployeeRole })
    @IsOptional()
    @IsEnum(EmployeeRole)
    role?: EmployeeRole;

    @ApiPropertyOptional({ example: 'CEO' })
    @IsOptional()
    @IsString()
    customRole?: string;

    @ApiPropertyOptional({ enum: EmployeeStatus })
    @IsOptional()
    @IsEnum(EmployeeStatus)
    status?: EmployeeStatus;
}
