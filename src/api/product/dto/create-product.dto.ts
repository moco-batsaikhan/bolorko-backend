import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  Min,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({
    description: 'Name of the product',
    example: 'iPhone 13 Pro',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the product',
    example: 'Latest iPhone with advanced camera system',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Price of the product',
    example: 999.99,
  })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description:
      'Discounted (sale) price — must be lower than price. Send null to remove the discount.',
    example: 79999,
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return parseFloat(value);
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number | null;

  @ApiProperty({
    description: 'Stock quantity',
    example: 50,
  })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({
    description: 'Category ID',
    example: 1,
    required: false,
  })
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @ApiProperty({
    description: 'Product status',
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
    required: false,
  })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({
    description: 'Product images array',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    required: false,
    type: [String],
  })
  @IsOptional()
  images?: string[];

  @ApiProperty({
    description: 'Whether the product is featured',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiProperty({
    description: 'Available colors',
    example: ['Хөх', 'Улаан'],
    required: false,
    type: [String],
  })
  @IsOptional()
  colors?: string[];

  @ApiProperty({
    description: 'Available sizes',
    example: ['S', 'M', 'L'],
    required: false,
    type: [String],
  })
  @IsOptional()
  sizes?: string[];
}
