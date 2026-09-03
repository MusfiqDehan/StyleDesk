import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'oldSecret123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({ example: 'newSecret456', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
