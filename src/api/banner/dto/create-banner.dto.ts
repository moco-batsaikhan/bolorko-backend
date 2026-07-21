import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBannerDto {
  @ApiProperty({
    description: 'Title of the banner',
    example: 'Summer Sale',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Description of the banner',
    example: 'Up to 50% off on all products',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Banner image URL',
    example: '/uploads/banners/abc123.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    description: 'Link the banner points to',
    example: '/products/1',
    required: false,
  })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiProperty({
    description: 'Sort order of the banner',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({
    description: 'Whether the banner is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
