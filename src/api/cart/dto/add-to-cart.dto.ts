import { IsNumber, IsInt, Min } from 'class-validator';
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
}
