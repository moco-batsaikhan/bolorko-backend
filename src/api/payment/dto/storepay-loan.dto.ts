import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsIn,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStorepayLoanDto {
  @ApiProperty({ description: 'Дэлгүүрийн дугаар', required: false })
  @IsOptional()
  @IsNumber()
  public storeId?: number;

  @ApiProperty({ description: 'Утасны дугаар', example: '99999999' })
  @IsString()
  public mobileNumber: string;

  @ApiProperty({ description: 'Тайлбар', example: 'Order #1' })
  @IsString()
  public description: string;

  @ApiProperty({ description: 'Дүн', example: 100000 })
  @IsNumber()
  @Min(0)
  public amount: number;

  @ApiProperty({ description: 'Холбогдох захиалгын дугаар', required: false })
  @IsOptional()
  @IsNumber()
  public orderId?: number;

  @ApiProperty({
    description: 'Нэхэмжлэх баталгаажих үед дуудагдах webhook url',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  public callbackUrl?: string;
}

export class CancelStorepayLoanDto {
  @ApiProperty({ description: 'Нэхэмжлэлийн дугаар', example: 12345 })
  @IsNumber()
  public accountId: number;
}

export class StorepayLoanChangeDto {
  @ApiProperty({ description: '1 = Дүн солих, 2 = Цуцлах', example: 1 })
  @IsIn([1, 2])
  public changeTypeId: number;

  @ApiProperty({ description: 'Нэхэмжлэлийн дугаар', example: 12345 })
  @IsNumber()
  public loanId: number;

  @ApiProperty({ description: 'Тайлбар', example: 'Дүн зөрсөн' })
  @IsString()
  public reason: string;

  @ApiProperty({
    description: 'Шинэ дүн, changeTypeId = 1 үед заавал',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  public amount?: number;
}
