import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StorepayService } from './storepay.service';
import { PocketService } from './pocket.service';
import { Payment } from './entities/payment.entity';
import { Invoice } from './entities/invoice.entity';
import { StorepayLoan } from './entities/storepay-loan.entity';
import { PocketInvoice } from './entities/pocket-invoice.entity';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Invoice,
      StorepayLoan,
      PocketInvoice,
      Order,
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, StorepayService, PocketService],
  exports: [PaymentService, StorepayService, PocketService],
})
export class PaymentModule {}
