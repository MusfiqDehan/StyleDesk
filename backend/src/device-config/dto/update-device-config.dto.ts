import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsPrivateIpv4 } from '../../common/validators/is-private-ipv4.decorator.js';

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export class UpdateDeviceConfigDto {
  @ApiProperty({ example: '192.168.10.201', description: 'ZKTeco device LAN IP address' })
  @Matches(IP_REGEX, { message: 'deviceIp must be a valid IPv4 address' })
  @IsPrivateIpv4()
  deviceIp: string;

  @ApiProperty({ example: 4370, description: 'ZKTeco device port' })
  @IsInt()
  @Min(1)
  @Max(65535)
  devicePort: number;

  @ApiPropertyOptional({ example: '255.255.255.0' })
  @IsOptional()
  @Matches(IP_REGEX, { message: 'subnetMask must be a valid IPv4 mask' })
  subnetMask?: string;

  @ApiPropertyOptional({ example: '192.168.10.1' })
  @IsOptional()
  @Matches(IP_REGEX, { message: 'gateway must be a valid IPv4 address' })
  @IsPrivateIpv4()
  gateway?: string;

  @ApiPropertyOptional({ example: '8.8.8.8' })
  @IsOptional()
  @Matches(IP_REGEX, { message: 'dnsServer must be a valid IPv4 address' })
  dnsServer?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  communicationKey?: string;
}
