import { IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PocketInvoiceType,
  PocketInvoiceChannel,
} from '../entities/pocket-invoice.entity';

export class CreatePocketInvoiceDto {
  @ApiProperty({ description: 'Терминалын дугаар', required: false })
  @IsOptional()
  @IsNumber()
  public terminalId?: number;

  @ApiProperty({ description: 'Дүн', example: 100000 })
  @IsNumber()
  @Min(0)
  public amount: number;

  @ApiProperty({
    description: 'Нэхэмжлэлийн нэмэлт мэдээлэл',
    required: false,
  })
  @IsOptional()
  @IsString()
  public info?: string;

  @ApiProperty({
    description: 'Захиалгын дугаар, өгөгдөөгүй бол автоматаар үүснэ',
    required: false,
  })
  @IsOptional()
  @IsString()
  public orderNumber?: string;

  @ApiProperty({
    description: 'Нэхэмжлэлийн төрөл',
    enum: PocketInvoiceType,
    default: PocketInvoiceType.ZERO,
    required: false,
  })
  @IsOptional()
  @IsEnum(PocketInvoiceType)
  public invoiceType?: PocketInvoiceType;

  @ApiProperty({
    description: 'Худалдан авалт хийгдэж буй суваг',
    enum: PocketInvoiceChannel,
    default: PocketInvoiceChannel.ECOMMERCE,
    required: false,
  })
  @IsOptional()
  @IsEnum(PocketInvoiceChannel)
  public channel?: PocketInvoiceChannel;

  @ApiProperty({ description: 'Холбогдох захиалгын дугаар', required: false })
  @IsOptional()
  @IsNumber()
  public orderId?: number;
}

export class CheckPocketInvoiceByIdDto {
  @ApiProperty({ description: 'Терминалын дугаар', required: false })
  @IsOptional()
  @IsNumber()
  public terminalId?: number;

  @ApiProperty({ description: 'Pocket-с үүсгэсэн нэхэмжлэлийн дугаар' })
  @IsNumber()
  public invoiceId: number;
}
