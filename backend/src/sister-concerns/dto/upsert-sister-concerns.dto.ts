import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertSisterConcernsDto {
  @ApiPropertyOptional({ example: 'Sister Concerns' })
  @IsString()
  @IsOptional()
  aboveText?: string;

  @ApiPropertyOptional({ example: 'Meher by *Samina Sara*' })
  @IsString()
  @IsOptional()
  mainText?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subText?: string;

  @ApiPropertyOptional({ example: 'Visit Meher' })
  @IsString()
  @IsOptional()
  buttonText?: string;

  @ApiPropertyOptional({ example: 'https://www.meherbd.com/' })
  @IsString()
  @IsOptional()
  buttonLink?: string;
}
