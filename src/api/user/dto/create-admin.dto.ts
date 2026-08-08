import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Admin name',
    example: 'Admin User',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Admin phone number (8 digits)',
    example: '99112233',
  })
  @Matches(/^[0-9]{8}$/, { message: 'Утасны дугаар 8 оронтой байх ёстой' })
  phone: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'admin123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
