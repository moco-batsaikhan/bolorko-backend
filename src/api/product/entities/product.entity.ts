import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  AfterLoad,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { ProductRating } from './product-rating.entity';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export enum ProductPostType {
  PRODUCT = 'PRODUCT',
  INFO = 'INFO',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  // Discounted price; null when the product is not on sale
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice: number | null;

  // Computed after load, not stored: percent off when salePrice is set
  discountPercentage: number | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'categoryId', type: 'int', nullable: true })
  categoryId: number | null;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({
    type: 'enum',
    enum: ProductPostType,
    default: ProductPostType.PRODUCT,
  })
  postType: ProductPostType;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ type: 'json', nullable: true })
  images: string[];

  // Available colors/sizes — manually set, or parsed from a Facebook post's
  // "Өнгө:"/"Размер:" sections during sync
  @Column({ type: 'json', nullable: true })
  colors: string[] | null;

  @Column({ type: 'json', nullable: true })
  sizes: string[] | null;

  // False for products that can't be paid for via installment services
  // (Storepay/Pocket) — set by admin
  @Column({ default: true })
  installmentPaymentAllowed: boolean;

  // Facebook sync fields
  @Column({ type: 'varchar', unique: true, nullable: true })
  facebookPostId: string | null;

  @Column({ type: 'varchar', nullable: true })
  permalinkUrl: string | null;

  @Column({ type: 'datetime', nullable: true })
  postedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory | null;

  @OneToMany(() => ProductRating, (rating) => rating.product)
  ratings: ProductRating[];

  @AfterLoad()
  computeDiscountPercentage(): void {
    const price = Number(this.price);
    const salePrice = this.salePrice === null ? null : Number(this.salePrice);

    if (salePrice !== null && price > 0 && salePrice < price) {
      this.discountPercentage = Math.round((1 - salePrice / price) * 100);
    } else {
      this.discountPercentage = null;
    }
  }

  // Price the buyer actually pays
  getEffectivePrice(): number {
    return Number(this.salePrice ?? this.price);
  }

  // Helper methods
  updateStock(quantity: number): void {
    this.stock = quantity;
    // Status is no longer auto-toggled based on stock reaching 0 (disabled
    // per request — stock running out should not make the product INACTIVE).
    // if (this.stock <= 0) {
    //   this.status = ProductStatus.OUT_OF_STOCK;
    // } else {
    //   this.status = ProductStatus.ACTIVE;
    // }
  }

  updatePrice(price: number): void {
    this.price = price;
  }

  // Rating methods
  updateRating(newAverageRating: number, newRatingCount: number): void {
    this.averageRating = newAverageRating;
    this.ratingCount = newRatingCount;
  }

  // Image methods
  addImage(imageUrl: string): void {
    if (!this.images) {
      this.images = [];
    }
    this.images.push(imageUrl);
  }

  removeImage(imageUrl: string): void {
    if (this.images) {
      this.images = this.images.filter((img) => img !== imageUrl);
    }
  }

  setImages(images: string[]): void {
    this.images = images;
  }
}
