import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  invoiceId: string;

  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number | null;

  // Linked order — set when the invoice was created for an order
  @Column({ name: 'orderId', type: 'int', nullable: true })
  orderId: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  redirectUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productName: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @Column({ name: 'paidAt', nullable: true })
  paidAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  status: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  qpayInvoiceId: string | null;
}
