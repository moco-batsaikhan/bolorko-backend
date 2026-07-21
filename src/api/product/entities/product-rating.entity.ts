import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../user/entities/user.entity';

@Entity('product_ratings')
export class ProductRating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  rating: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ name: 'productId' })
  productId: number;

  @Column({ name: 'userId' })
  userId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => Product, (product) => product.ratings)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
