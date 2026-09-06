import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementPriority, AnnouncementTarget } from '../entities/announcement.entity';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Eid Holiday Notice', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'The office will remain closed from April 28 to May 2 for Eid-ul-Fitr.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: AnnouncementPriority, example: AnnouncementPriority.MEDIUM })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiPropertyOptional({ enum: AnnouncementTarget, example: AnnouncementTarget.ALL })
  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;
}
