import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class SendPasswordResetDto {
  @ApiProperty({
    description: 'Email address of the recipient',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'Password reset URL',
    example: 'https://example.com/reset-password?token=abc123',
  })
  @IsUrl({}, { message: 'Invalid URL format' })
  @IsNotEmpty({ message: 'URL is required' })
  url: string;
}
