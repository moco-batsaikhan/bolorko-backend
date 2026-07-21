import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ default: false })
  isFeatured: boolean;

  // Null for main categories; set for sub categories
  @Column({ type: 'int', nullable: true })
  parentId: number | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => ProductCategory, (category) => category.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent: ProductCategory | null;

  @OneToMany(() => ProductCategory, (category) => category.parent)
  children: ProductCategory[];

  @OneToMany('Product', 'category')
  products: any[];

  // Helper methods
  updateCategory(name: string, description?: string): void {
    this.name = name;
    if (description !== undefined) {
      this.description = description;
    }
  }

  isMain(): boolean {
    return this.parentId === null;
  }
}
