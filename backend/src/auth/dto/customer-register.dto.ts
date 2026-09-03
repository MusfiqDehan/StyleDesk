import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CustomerRegisterDto {
  @ApiProperty({ description: 'Full name of the customer' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email of the customer' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Phone number of the customer' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Password' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
