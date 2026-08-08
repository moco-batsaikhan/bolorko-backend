import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { UserRoleEnum } from '../../user/entities/user-role.entity';

export class RegisterDto {
  @ApiProperty({
    description: 'User full name',
    example: 'Username',
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

  @ApiProperty({
    description: 'User role',
    enum: UserRoleEnum,
    example: UserRoleEnum.USER,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRoleEnum;
}
