import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEnum,
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
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

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
