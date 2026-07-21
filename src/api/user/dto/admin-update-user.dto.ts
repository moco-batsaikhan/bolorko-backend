import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleEnum } from '../entities/user-role.entity';

export class AdminUpdateUserDto {
  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'User role',
    example: 1,
    required: false,
  })
  @IsEnum(UserRoleEnum)
  @IsOptional()
  role?: UserRoleEnum;
}
