import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRolePermissionDto {
  @ApiProperty({ type: [String], example: ['appointments', 'clients', 'invoice'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
