import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User full name',
    example: 'Username',
  })
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: 'User phone number (8 digits)',
    example: '99112233',
  })
  @IsOptional()
  @Matches(/^[0-9]{8}$/, { message: 'Утасны дугаар 8 оронтой байх ёстой' })
  phone?: string;

  @ApiProperty({
    description: 'Role ID of the user',
    example: 2,
  })
  @IsOptional()
  roleId?: number;
}
