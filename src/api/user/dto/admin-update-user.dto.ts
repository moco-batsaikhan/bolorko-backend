import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  IsNumber,
  Matches,
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
    description: 'User phone number (8 digits)',
    example: '99112233',
    required: false,
  })
  @Matches(/^[0-9]{8}$/, { message: 'Утасны дугаар 8 оронтой байх ёстой' })
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'User role',
    example: 1,
    required: false,
  })
  @IsEnum(UserRoleEnum)
  @IsOptional()
  role?: UserRoleEnum;
}
