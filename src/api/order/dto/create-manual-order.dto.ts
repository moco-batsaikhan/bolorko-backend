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
  IsDateString,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  OrderStatus,
  OrderSource,
  OrderPaymentStatus,
} from '../entities/order.entity';

export class ManualOrderItemDto {
  @ApiProperty({
    description:
      'Product ID — сонгосон каталогийн бараа байвал. Хоосон бол customName заавал байна.',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  productId?: number;

  @ApiProperty({
    description:
      'Каталогт байхгүй, admin-ы гараар бичсэн барааны нэр. productId өгөгдөөгүй үед заавал.',
    example: 'Захиалгаар хийсэн бэлэг баглаа',
    required: false,
  })
  @IsString()
  @IsOptional()
  customName?: string;

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
    description:
      'Where the order came from. Defaults to FACEBOOK since this endpoint exists for orders taken outside the website checkout flow.',
    enum: OrderSource,
    example: OrderSource.FACEBOOK,
    required: false,
  })
  @IsEnum(OrderSource)
  @IsOptional()
  source?: OrderSource;

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

  @ApiProperty({
    description:
      'When the order actually happened (e.g. the Facebook chat date), as opposed to the moment the admin typed it in. Defaults to now when omitted.',
    example: '2026-07-15',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  orderDate?: string;
}
