import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EmailDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class EmailCodeDto extends EmailDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class PublicLoginDto extends EmailDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}

export class ResetPasswordDto extends EmailCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}
