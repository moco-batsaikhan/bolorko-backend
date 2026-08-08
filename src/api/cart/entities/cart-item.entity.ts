import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../../product/entities/product.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cartId' })
  cartId: number;

  @Column({ name: 'productId' })
  productId: number;

  @Column({ type: 'int' })
  quantity: number;

  // Which of the product's available colors/sizes the buyer picked
  @Column({ type: 'varchar', nullable: true })
  selectedColor: string | null;

  @Column({ type: 'varchar', nullable: true })
  selectedSize: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => Cart, (cart) => cart.cartItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Helper methods
  updateQuantity(newQuantity: number): void {
    this.quantity = newQuantity;
  }

  calculateSubtotal(): number {
    return this.quantity * this.product.price;
  }
}
