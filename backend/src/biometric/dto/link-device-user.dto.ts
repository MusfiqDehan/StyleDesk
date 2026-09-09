import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkDeviceUserDto {
  @ApiProperty({ description: 'Device UID from ZKTeco device' })
  @IsString()
  @IsNotEmpty()
  device_uid: string;

  @ApiProperty({ description: 'UUID of the employee to link' })
  @IsString()
  @IsNotEmpty()
  employee_id: string;
}
