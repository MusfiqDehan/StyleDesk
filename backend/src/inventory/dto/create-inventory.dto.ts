import { IsString, IsNumber, IsDateString, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInventoryDto {
  @ApiProperty({ example: 'Loreal Hair Dye - Black' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Hair Care' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: 50, description: 'Current stock quantity' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  stockQty: number;

  @ApiProperty({ example: 10, description: 'Minimum stock level before alert' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  minStockLevel: number;

  @ApiProperty({ example: 350, description: 'Unit price in BDT' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 'Loreal Bangladesh Ltd.' })
  @IsNotEmpty()
  @IsString()
  supplier: string;

  @ApiProperty({ example: '2025-12-31', description: 'Expiry date (ISO 8601)' })
  @IsNotEmpty()
  @IsDateString()
  expiryDate: string;
}
