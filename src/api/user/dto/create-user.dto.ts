import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'User name',
  })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'User phone number (8 digits)',
    example: '99112233',
  })
  @Matches(/^[0-9]{8}$/, { message: 'Утасны дугаар 8 оронтой байх ёстой' })
  phone: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'password123',
    minLength: 6,
  })
  @MinLength(6)
  password: string;
}
