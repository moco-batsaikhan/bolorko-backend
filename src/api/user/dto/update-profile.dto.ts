import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User full name',
    example: 'Username',
  })
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Role ID of the user',
    example: 2,
  })
  @IsOptional()
  roleId?: number;
}
