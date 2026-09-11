import { ApiProperty } from '@nestjs/swagger';
import { IsIP } from 'class-validator';
import { IsPrivateIpv4 } from '../../common/validators/is-private-ipv4.decorator.js';

export class OverrideIpDto {
  @ApiProperty({
    example: '192.168.10.55',
    description: 'Static private/LAN IP to use instead of auto-discovery',
  })
  @IsIP('4')
  @IsPrivateIpv4()
  ip: string;
}
