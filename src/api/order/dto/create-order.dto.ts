import {
  IsNumber,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: 1,
  })
  @IsNumber()
  productId: number;

  @ApiProperty({
    description: 'Quantity',
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

export class ShippingAddressDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Ulaanbaatar' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Some street 123' })
  @IsString()
  addressLine: string;

  @ApiProperty({ example: 'Leave at the door', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Order items',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  orderItems: CreateOrderItemDto[];

  @ApiProperty({
    description: 'Shipping address',
    type: ShippingAddressDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @ApiProperty({
    description: 'Customer phone number (used to reach the buyer)',
    example: '99112233',
  })
  @IsString()
  phone: string;
}
