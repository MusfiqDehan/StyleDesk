import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTestimonialDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'CEO, Tech Corp' })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiProperty({ example: 'PrivéforYou provides the best luxury experience.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'uuid.webp' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
