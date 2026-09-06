import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsBoolean, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStyleDeskPackageDto {
  @ApiProperty({ example: 'SIGNATURE' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'Radiant Glow' })
  @IsString()
  @IsNotEmpty()
  // title/features are stored as comma-separated `simple-array` columns on
  // bookings/invoices — a comma would silently split into fake extra line items.
  @Matches(/^[^,]*$/, { message: 'Title cannot contain a comma (,)' })
  title: string;

  @ApiProperty({ example: 399 })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({ example: '/ session' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiProperty({ example: 'Our most popular package...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: ['Advanced facial', 'Full body massage'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[^,]*$/, { each: true, message: 'Feature names cannot contain a comma (,)' })
  features: string[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  position?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
