import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBeginYourJourneyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
