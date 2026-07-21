import { IsEnum, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus, OrderSource } from '../entities/order.entity';

export class FilterOrdersDto {
  @ApiProperty({
    description: 'Filter by order source',
    enum: OrderSource,
    required: false,
  })
  @IsEnum(OrderSource)
  @IsOptional()
  source?: OrderSource;

  @ApiProperty({
    description: 'Filter by order status',
    enum: OrderStatus,
    required: false,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({
    description: 'Start date (inclusive), e.g. 2026-07-01',
    example: '2026-07-01',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date (inclusive), e.g. 2026-07-31',
    example: '2026-07-31',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: 'Page number', example: 1, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 20, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
