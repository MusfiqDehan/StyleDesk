import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNewsLetterSubscriberDto {
  @ApiProperty({ example: 'subscriber@example.com', description: 'The email address of the newsletter subscriber' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
