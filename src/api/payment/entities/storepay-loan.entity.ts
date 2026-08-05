import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

export enum StorepayLoanStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

@Entity('storepay_loans')
export class StorepayLoan {
  @PrimaryGeneratedColumn()
  id: number;

  // Дугаар (loanId) буцаагдсаны дараа бөглөгдөнө
  @Column({ type: 'int', nullable: true })
  loanId: number | null;

  // Бидний үүсгэсэн, checkRequest-ээр лавлахад ашиглагдах давтагдашгүй дугаар
  @Column({ unique: true })
  requestId: string;

  @Column({ name: 'orderId', type: 'int', nullable: true })
  orderId: number | null;

  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'int' })
  storeId: number;

  @Column({ type: 'varchar', length: 32 })
  mobileNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  callbackUrl: string | null;

  @Column({
    type: 'enum',
    enum: StorepayLoanStatus,
    default: StorepayLoanStatus.PENDING,
  })
  status: StorepayLoanStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @Column({ name: 'confirmedAt', type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
