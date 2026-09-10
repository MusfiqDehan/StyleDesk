import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'Ayesha Rahman' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '01712345678', description: 'Valid Bangladeshi phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, { message: 'phone must be a valid Bangladeshi phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'ayesha@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Dhaka, Bangladesh' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Riya' })
  @IsOptional()
  @IsString()
  preferredStylist?: string;

  @ApiPropertyOptional({ example: 'Prefers morning slots' })
  @IsOptional()
  @IsString()
  notes?: string;
}
