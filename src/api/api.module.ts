import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { CartModule } from './cart/cart.module';
import { PaymentModule } from './payment/payment.module';
import { BannerModule } from './banner/banner.module';
import { ReportModule } from './report/report.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    ProductModule,
    OrderModule,
    CartModule,
    PaymentModule,
    BannerModule,
    ReportModule,
    MailModule,
  ],
})
export class ApiModule {}
