import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../product/entities/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'orderId' })
  orderId: number;

  @Column({ name: 'productId' })
  productId: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  // Which of the product's available colors/sizes the buyer picked
  @Column({ type: 'varchar', nullable: true })
  selectedColor: string | null;

  @Column({ type: 'varchar', nullable: true })
  selectedSize: string | null;

  @ManyToOne(() => Order, (order) => order.orderItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Helper methods
  calculateSubtotal(): number {
    return this.quantity * this.unitPrice;
  }

  updateQuantity(newQuantity: number): void {
    this.quantity = newQuantity;
  }
}
