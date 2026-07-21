import {
  IsNumber,
  Min,
  Max,
  IsUrl,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InvoiceDto {
  @ApiProperty({ description: 'Amount', example: 1000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, {
    message: 'amount must be greater than 0!',
  })
  @Max(10000000, {
    message: 'amount must be less than 10,000,000!',
  })
  public amount?: number;

  @ApiProperty({
    description: 'Linked order ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  public orderId?: number;

  @ApiProperty({ description: 'Redirect URL', required: false })
  @IsOptional()
  public redirectUrl?: string;

  @ApiProperty({ description: 'Customer email', required: false })
  @IsOptional()
  @IsString()
  public email?: string;

  @ApiProperty({ description: 'Product name', required: false })
  @IsOptional()
  @IsString()
  public productName?: string;
}
