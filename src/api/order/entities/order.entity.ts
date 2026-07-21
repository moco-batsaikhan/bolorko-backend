import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderSource {
  WEBSITE = 'WEBSITE',
  FACEBOOK = 'FACEBOOK',
}

export enum PaymentMethod {
  QPAY = 'QPAY',
  MANUAL = 'MANUAL',
}

export enum OrderPaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  // Null for manually entered (Facebook) orders without an account
  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number | null;

  @Column({
    type: 'enum',
    enum: OrderSource,
    default: OrderSource.WEBSITE,
  })
  source: OrderSource;

  // Customer info for manual (Facebook) orders
  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.QPAY,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.UNPAID,
  })
  paymentStatus: OrderPaymentStatus;

  // Free-form note: Facebook chat link, agreement details, etc.
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @OneToMany('OrderItem', 'order', {
    cascade: true,
  })
  orderItems: any[];

  @Column({ type: 'json', name: 'shippingAddress', nullable: true })
  shippingAddress: {
    fullName: string;
    phone: string;
    city: string;
    addressLine: string;
    note?: string;
  } | null;
  // Helper methods
  placeOrder(): void {
    // Calculate total from order items
    this.total = this.orderItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
  }

  cancelOrder(): void {
    this.status = OrderStatus.CANCELLED;
  }

  markAsPaid(): void {
    this.status = OrderStatus.PAID;
    this.paymentStatus = OrderPaymentStatus.PAID;
  }

  calculateTotal(): number {
    return this.orderItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
  }
}
