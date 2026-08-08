import { IsNumber, IsInt, Min, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({
    description: 'Product ID to add to cart',
    example: 1,
  })
  @IsNumber()
  productId: number;

  @ApiProperty({
    description: 'Quantity to add',
    example: 2,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Selected color, if the product has a colors list',
    example: 'Хөх',
    required: false,
  })
  @IsOptional()
  @IsString()
  selectedColor?: string;

  @ApiProperty({
    description: 'Selected size, if the product has a sizes list',
    example: 'M',
    required: false,
  })
  @IsOptional()
  @IsString()
  selectedSize?: string;
}
