import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductCategoryService } from './product-category.service';
import { FacebookSyncService } from './facebook-sync.service';
import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { ProductRating } from './entities/product-rating.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { OrderItem } from '../order/entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductCategory,
      ProductRating,
      CartItem,
      OrderItem,
    ]),
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductCategoryService, FacebookSyncService],
  exports: [ProductService, ProductCategoryService, FacebookSyncService],
})
export class ProductModule {}
