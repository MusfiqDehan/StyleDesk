import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../auth/entities/auth.entity.js';

export class CreateUserManagementDto {
  @ApiProperty({ example: 'staff@salon.com' })
  @IsEmail()
  @IsNotEmpty()
  useremail: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STAFF })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiPropertyOptional({
    example: ['invoice', 'clients'],
    type: [String],
    description: 'Granted module permissions for custom-role users',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({
    example: 'uuid-string-here',
    description: 'The UUID of the employee to link this account to',
  })
  @IsOptional()
  @IsString()
  employeeId?: string;
}
