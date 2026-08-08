import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User phone number (8 digits)',
    example: '99112233',
  })
  @Matches(/^[0-9]{8}$/, { message: 'Утасны дугаар 8 оронтой байх ёстой' })
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
