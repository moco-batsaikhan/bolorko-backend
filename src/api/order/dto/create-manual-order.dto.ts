import {
  IsNumber,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  OrderStatus,
  OrderPaymentStatus,
} from '../entities/order.entity';

export class ManualOrderItemDto {
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
    description:
      'Unit price override (agreed price on Facebook). Defaults to the product price.',
    example: 85000,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

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

export class CreateManualOrderDto {
  @ApiProperty({
    description: 'Customer name',
    example: 'Бат-Эрдэнэ',
  })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '99112233',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Delivery address',
    example: 'УБ, СБД, 1-р хороо ...',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Note: Facebook chat link, agreement details, etc.',
    example: 'FB chat: https://m.me/...  Урьдчилгаа 50% төлсөн',
    required: false,
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({
    description: 'Order items',
    type: [ManualOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items: ManualOrderItemDto[];

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    required: false,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({
    description: 'Payment status',
    enum: OrderPaymentStatus,
    example: OrderPaymentStatus.UNPAID,
    required: false,
  })
  @IsEnum(OrderPaymentStatus)
  @IsOptional()
  paymentStatus?: OrderPaymentStatus;
}
