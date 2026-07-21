import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'userId' })
  userId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany('CartItem', 'cart', {
    cascade: true,
  })
  cartItems: any[];

  // Helper methods
  addItem(productId: number, quantity: number): void {
    // Logic to add item to cart will be handled in service
  }

  removeItem(productId: number): void {
    // Logic to remove item from cart will be handled in service
  }

  clearCart(): void {
    this.cartItems = [];
  }

  calculateTotal(): number {
    return this.cartItems.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0,
    );
  }
}
