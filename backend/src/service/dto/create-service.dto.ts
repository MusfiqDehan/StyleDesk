import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory, ServiceStatus } from '../entities/service.entity';

export class CreateServiceDto {
  @ApiProperty({ example: 'Hair Coloring' })
  @IsString()
  @IsNotEmpty()
  // Service/package names are stored as comma-separated `simple-array` columns on
  // bookings/invoices — a comma in the name would silently split into multiple fake
  // line items and corrupt totals/quantities everywhere they're read back.
  @Matches(/^[^,]*$/, { message: 'Name cannot contain a comma (,)' })
  name: string;

  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({ example: 1200, description: 'Price in BDT' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 60, description: 'Duration in minutes' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ enum: ServiceStatus })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({ example: 'Full head hair coloring with premium dye' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '/uploads/hair-coloring.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 10, description: 'Commission percentage (0-100) paid to employee who performs this service' })
  @IsOptional()
  @IsNumber()
  commission?: number;

}
