import { IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Order ID for the payment',
    example: 1,
  })
  @IsNumber()
  orderId: number;

  @ApiProperty({
    description: 'Payment amount',
    example: 999.99,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.QPAY,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
