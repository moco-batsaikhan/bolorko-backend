import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

export enum PocketInvoiceType {
  ZERO = 'ZERO',
  LEASING = 'LEASING',
}

export enum PocketInvoiceChannel {
  ECOMMERCE = 'ecommerce',
  POS = 'pos',
}

// Mirrors the string `state` field returned by API 3.1/3.2 (invoice lookup).
// The webhook (API 6) sends the same states as integer codes instead.
export enum PocketInvoiceState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  UNSUCCESS = 'unsuccess',
}

@Entity('pocket_invoices')
export class PocketInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  // Pocket-с үүсгэсэн нэхэмжлэлийн дугаар (generate-invoice хариунаас)
  @Column({ type: 'int', nullable: true })
  invoiceId: number | null;

  // Бидний үүсгэсэн, давтагдашгүй захиалгын дугаар (orderNumber)
  @Column({ unique: true })
  orderNumber: string;

  @Column({ name: 'orderId', type: 'int', nullable: true })
  orderId: number | null;

  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number | null;

  // Терминалын дугаарууд int32-ийн хязгаараас давдаг тул bigint ашиглав.
  // mysql2 драйвер bigint баганыг string-ээр буцаадаг.
  @Column({ type: 'bigint' })
  terminalId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  info: string | null;

  @Column({
    type: 'enum',
    enum: PocketInvoiceType,
    default: PocketInvoiceType.ZERO,
  })
  invoiceType: PocketInvoiceType;

  @Column({
    type: 'enum',
    enum: PocketInvoiceChannel,
    default: PocketInvoiceChannel.ECOMMERCE,
  })
  channel: PocketInvoiceChannel;

  @Column({ type: 'text', nullable: true })
  qr: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  deeplink: string | null;

  @Column({
    type: 'enum',
    enum: PocketInvoiceState,
    default: PocketInvoiceState.PENDING,
  })
  state: PocketInvoiceState;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @Column({ name: 'paidAt', nullable: true })
  paidAt: Date | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
