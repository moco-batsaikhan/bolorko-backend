import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

export enum PaymentMethod {
  QPAY = 'QPay',
  CARD = 'Card',
  CASH = 'Cash',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'orderId' })
  orderId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => Order, { nullable: false })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // Helper methods
  processPayment(): boolean {
    // Payment processing logic would go here
    // For now, we'll just mark as completed
    this.status = PaymentStatus.COMPLETED;
    return true;
  }

  refund(): boolean {
    if (this.status === PaymentStatus.COMPLETED) {
      this.status = PaymentStatus.REFUNDED;
      return true;
    }
    return false;
  }

  markAsFailed(): void {
    this.status = PaymentStatus.FAILED;
  }
}
