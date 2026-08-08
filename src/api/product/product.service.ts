import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Product,
  ProductPostType,
  ProductStatus,
} from './entities/product.entity';
import { ProductRating } from './entities/product-rating.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductRatingDto } from './dto/create-product-rating.dto';
import { UpdateProductRatingDto } from './dto/update-product-rating.dto';
import { ProductCategoryService } from './product-category.service';
import { CartItem } from '../cart/entities/cart-item.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { deleteS3ObjectByUrl } from '../../common/storage/s3-storage';

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductRating)
    private readonly ratingRepository: Repository<ProductRating>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly productCategoryService: ProductCategoryService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Verify category exists if provided
    if (createProductDto.categoryId) {
      await this.productCategoryService.findOne(createProductDto.categoryId);
    }

    const product = this.productRepository.create(createProductDto);
    this.validateSalePrice(product);

    // Set status based on stock
    if (product.stock <= 0) {
      product.status = ProductStatus.OUT_OF_STOCK;
    }

    const savedProduct = await this.productRepository.save(product);

    // Return the created product with all relations
    return await this.findOne(savedProduct.id);
  }

  async findAll(
    postType?: string,
    categoryId?: number,
    search?: string,
    page?: number,
    limit?: number,
  ): Promise<Product[] | PaginatedProducts> {
    if (
      postType &&
      !Object.values(ProductPostType).includes(postType as ProductPostType)
    ) {
      throw new BadRequestException(
        `Invalid type "${postType}". Allowed values: ${Object.values(ProductPostType).join(', ')}`,
      );
    }

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.ratings', 'ratings')
      .leftJoinAndSelect('ratings.user', 'ratingUser');

    if (postType) {
      query.andWhere('product.postType = :postType', { postType });
    }

    if (categoryId) {
      // A main category also covers products of its sub categories
      const category = await this.productCategoryService.findOne(categoryId);
      const categoryIds = [
        category.id,
        ...(category.children?.map((child) => child.id) ?? []),
      ];
      query.andWhere('product.categoryId IN (:...categoryIds)', {
        categoryIds,
      });
    }

    if (search?.trim()) {
      query.andWhere(
        '(product.name LIKE :search OR product.description LIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Zero-price PRODUCT ads aren't purchasable — don't show them in the
    // public listing. INFO posts have no price by nature and stay visible.
    query.andWhere(
      '(product.price > 0 OR product.postType = :infoType)',
      { infoType: ProductPostType.INFO },
    );

    // Inactive products (deactivated by admin) shouldn't appear on the site
    query.andWhere('product.status != :inactiveStatus', {
      inactiveStatus: ProductStatus.INACTIVE,
    });

    // Backward-compatible: without page/limit, return the full array as
    // before (existing callers, e.g. the admin page, are unaffected)
    if (!page || !limit) {
      return await query.getMany();
    }

    const [data, total] = await query
      .orderBy('product.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findFeatured(): Promise<Product[]> {
    return await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.ratings', 'ratings')
      .leftJoinAndSelect('ratings.user', 'ratingUser')
      .where('product.isFeatured = :isFeatured', { isFeatured: true })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('(product.price > 0 OR product.postType = :infoType)', {
        infoType: ProductPostType.INFO,
      })
      .orderBy('product.createdAt', 'DESC')
      .getMany();
  }

  async setFeatured(id: number, isFeatured: boolean): Promise<Product> {
    const product = await this.findOne(id);
    product.isFeatured = isFeatured;
    await this.productRepository.save(product);

    // Return the updated product with all relations
    return await this.findOne(id);
  }

  async findByCategory(categoryId: number): Promise<Product[]> {
    return await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.categoryId = :categoryId', { categoryId })
      .andWhere('(product.price > 0 OR product.postType = :infoType)', {
        infoType: ProductPostType.INFO,
      })
      .andWhere('product.status != :inactiveStatus', {
        inactiveStatus: ProductStatus.INACTIVE,
      })
      .getMany();
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'ratings', 'ratings.user'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // If category is being updated, verify it exists
    if (
      updateProductDto.categoryId &&
      updateProductDto.categoryId !== product.categoryId
    ) {
      await this.productCategoryService.findOne(updateProductDto.categoryId);
    }

    Object.assign(product, updateProductDto);
    this.validateSalePrice(product);

    // Status is not auto-overridden based on stock on update (disabled per
    // request — stock enforcement is disabled elsewhere too, and this used
    // to silently replace whatever status the admin just picked in the edit
    // form with OUT_OF_STOCK, a value the admin frontend's status dropdown
    // doesn't even offer).
    // if (product.stock <= 0) {
    //   product.status = ProductStatus.OUT_OF_STOCK;
    // } else if (
    //   product.status === ProductStatus.OUT_OF_STOCK &&
    //   product.stock > 0
    // ) {
    //   product.status = ProductStatus.ACTIVE;
    // }

    await this.productRepository.save(product);

    // Return the updated product with all relations
    return await this.findOne(id);
  }

  private validateSalePrice(product: Product): void {
    if (
      product.salePrice != null &&
      Number(product.salePrice) >= Number(product.price)
    ) {
      throw new BadRequestException(
        'Sale price must be lower than the regular price',
      );
    }
  }

  async updateStock(id: number, quantity: number): Promise<Product> {
    const product = await this.findOne(id);
    product.updateStock(quantity);
    await this.productRepository.save(product);

    // Return the updated product with all relations
    return await this.findOne(id);
  }

  /**
   * Conditional UPDATE (stock - :quantity WHERE id = :id). Pass `manager`
   * to run as part of a caller's transaction.
   *
   * Stock balance is not checked/enforced when placing an order (disabled
   * per request) — the `stock >= :quantity` gate that used to block
   * decrementing below zero is removed, so stock can go negative.
   */
  async decreaseStock(
    id: number,
    quantity: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager
      ? manager.getRepository(Product)
      : this.productRepository;

    const result = await repo
      .createQueryBuilder()
      .update(Product)
      .set({
        stock: () => 'stock - :quantity',
        status: () =>
          `CASE WHEN stock - :quantity <= 0 THEN '${ProductStatus.OUT_OF_STOCK}' ELSE status END`,
      })
      .where('id = :id', { id, quantity })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return true;
  }

  async increaseStock(
    id: number,
    quantity: number,
    manager?: EntityManager,
  ): Promise<Product> {
    const repo = manager
      ? manager.getRepository(Product)
      : this.productRepository;

    const result = await repo
      .createQueryBuilder()
      .update(Product)
      .set({
        stock: () => 'stock + :quantity',
        status: () =>
          `CASE WHEN status = '${ProductStatus.OUT_OF_STOCK}' AND stock + :quantity > 0 THEN '${ProductStatus.ACTIVE}' ELSE status END`,
      })
      .where('id = :id', { id, quantity })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return (await repo.findOne({ where: { id } })) as Product;
  }

  async cleanup(): Promise<{
    deleted: number;
    skipped: number;
    deactivated: number;
  }> {
    // Delete products that have no images (null or empty array)
    const emptyImageProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.images IS NULL OR JSON_LENGTH(product.images) = 0')
      .getMany();

    let deleted = 0;
    let skipped = 0;

    for (const product of emptyImageProducts) {
      // Keep products referenced in orders for data integrity
      const orderItemsCount = await this.orderItemRepository.count({
        where: { productId: product.id },
      });

      if (orderItemsCount > 0) {
        skipped++;
        continue;
      }

      await this.cartItemRepository.delete({ productId: product.id });
      await this.ratingRepository.delete({ productId: product.id });
      await this.productRepository.remove(product);
      deleted++;
    }

    // Deactivate remaining active product ads that have no price
    // (INFO posts naturally have no price, so leave them untouched)
    const deactivateResult = await this.productRepository
      .createQueryBuilder()
      .update(Product)
      .set({ status: ProductStatus.INACTIVE })
      .where('price = 0 AND status = :status AND postType = :postType', {
        status: ProductStatus.ACTIVE,
        postType: ProductPostType.PRODUCT,
      })
      .execute();

    return { deleted, skipped, deactivated: deactivateResult.affected ?? 0 };
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);

    // Check if product is referenced in any orders (should not be deleted if in orders)
    const orderItemsCount = await this.orderItemRepository.count({
      where: { productId: id },
    });

    if (orderItemsCount > 0) {
      throw new BadRequestException(
        'Cannot delete product. This product is referenced in existing orders. ' +
          'Products cannot be deleted once they have been ordered for data integrity purposes.',
      );
    }

    // Delete related cart items (this is safe as carts are temporary)
    await this.cartItemRepository.delete({ productId: id });

    // Delete all product ratings
    await this.ratingRepository.delete({ productId: id });

    // Now safe to delete the product
    await this.productRepository.remove(product);

    await Promise.all((product.images ?? []).map(deleteS3ObjectByUrl));
  }

  // Rating methods
  async addRating(
    productId: number,
    userId: number,
    createRatingDto: CreateProductRatingDto,
  ): Promise<ProductRating> {
    // Check if product exists
    const product = await this.findOne(productId);

    // Check if user already rated this product
    const existingRating = await this.ratingRepository.findOne({
      where: { productId, userId },
    });

    if (existingRating) {
      throw new BadRequestException('You have already rated this product');
    }

    // Create new rating
    const rating = this.ratingRepository.create({
      ...createRatingDto,
      productId,
      userId,
    });

    const savedRating = await this.ratingRepository.save(rating);

    // Update product's average rating
    await this.updateProductRating(productId);

    return savedRating;
  }

  async updateRating(
    ratingId: number,
    userId: number,
    updateRatingDto: UpdateProductRatingDto,
  ): Promise<ProductRating> {
    const rating = await this.ratingRepository.findOne({
      where: { id: ratingId },
      relations: ['product'],
    });

    if (!rating) {
      throw new NotFoundException(`Rating with ID ${ratingId} not found`);
    }

    if (rating.userId !== userId) {
      throw new ForbiddenException('You can only update your own rating');
    }

    Object.assign(rating, updateRatingDto);
    const updatedRating = await this.ratingRepository.save(rating);

    // Update product's average rating
    await this.updateProductRating(rating.productId);

    return updatedRating;
  }

  async deleteRating(ratingId: number, userId: number): Promise<void> {
    const rating = await this.ratingRepository.findOne({
      where: { id: ratingId },
    });

    if (!rating) {
      throw new NotFoundException(`Rating with ID ${ratingId} not found`);
    }

    if (rating.userId !== userId) {
      throw new ForbiddenException('You can only delete your own rating');
    }

    const productId = rating.productId;
    await this.ratingRepository.remove(rating);

    // Update product's average rating
    await this.updateProductRating(productId);
  }

  async getProductRatings(
    productId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: ProductRating[]; total: number; pages: number }> {
    // Check if product exists
    await this.findOne(productId);

    const [data, total] = await this.ratingRepository.findAndCount({
      where: { productId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const pages = Math.ceil(total / limit);

    return { data, total, pages };
  }

  private async updateProductRating(productId: number): Promise<void> {
    const ratings = await this.ratingRepository.find({
      where: { productId },
    });

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) return;

    if (ratings.length === 0) {
      product.averageRating = 0;
      product.ratingCount = 0;
    } else {
      const totalRating = ratings.reduce(
        (sum, rating) => sum + rating.rating,
        0,
      );
      const averageRating = totalRating / ratings.length;

      product.averageRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place
      product.ratingCount = ratings.length;
    }

    await this.productRepository.save(product);
  }

  // Image management methods
  async addImages(
    productId: number,
    files: Express.MulterS3.File[],
  ): Promise<Product> {
    const product = await this.findOne(productId);
    const previousImages = product.images ?? [];

    // Add new image URLs
    const newImages = files.map((file) => file.location);
    product.images = [...newImages];

    await this.productRepository.save(product);
    await Promise.all(previousImages.map(deleteS3ObjectByUrl));

    // Return the updated product with all relations
    return await this.findOne(productId);
  }

  async removeImage(productId: number, imageUrl: string): Promise<Product> {
    const product = await this.findOne(productId);

    if (product.images) {
      product.removeImage(imageUrl);
      await this.productRepository.save(product);
      await deleteS3ObjectByUrl(imageUrl);
    }

    // Return the updated product with all relations
    return await this.findOne(productId);
  }

  async setImages(productId: number, imageUrls: string[]): Promise<Product> {
    const product = await this.findOne(productId);
    const removedImages = (product.images ?? []).filter(
      (img) => !imageUrls.includes(img),
    );

    product.setImages(imageUrls);
    await this.productRepository.save(product);
    await Promise.all(removedImages.map(deleteS3ObjectByUrl));

    // Return the updated product with all relations
    return await this.findOne(productId);
  }
}
