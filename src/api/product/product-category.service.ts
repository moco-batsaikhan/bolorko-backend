import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { deleteS3ObjectByUrl } from '../../common/storage/s3-storage';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepository: Repository<ProductCategory>,
  ) {}

  async create(
    createProductCategoryDto: CreateProductCategoryDto,
  ): Promise<ProductCategory> {
    if (createProductCategoryDto.parentId) {
      await this.validateParent(createProductCategoryDto.parentId);
    }

    const productCategory = this.productCategoryRepository.create(
      createProductCategoryDto,
    );
    return await this.productCategoryRepository.save(productCategory);
  }

  async findAll(): Promise<ProductCategory[]> {
    return await this.productCategoryRepository.find({
      relations: ['products', 'parent', 'children'],
    });
  }

  // Main categories with their sub categories nested
  async findMain(): Promise<ProductCategory[]> {
    return await this.productCategoryRepository.find({
      where: { parentId: IsNull() },
      relations: ['children'],
    });
  }

  async findFeatured(): Promise<ProductCategory[]> {
    return await this.productCategoryRepository.find({
      where: { isFeatured: true },
      relations: ['children'],
    });
  }

  async findOne(id: number): Promise<ProductCategory> {
    const productCategory = await this.productCategoryRepository.findOne({
      where: { id },
      relations: ['products', 'parent', 'children'],
    });

    if (!productCategory) {
      throw new NotFoundException(`Product category with ID ${id} not found`);
    }

    return productCategory;
  }

  async update(
    id: number,
    updateProductCategoryDto: UpdateProductCategoryDto,
  ): Promise<ProductCategory> {
    const productCategory = await this.findOne(id);

    if (updateProductCategoryDto.parentId) {
      if (updateProductCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      // A category that has sub categories must stay a main category
      if (productCategory.children?.length > 0) {
        throw new BadRequestException(
          'Category with sub categories cannot become a sub category itself',
        );
      }

      await this.validateParent(updateProductCategoryDto.parentId);
    }

    const previousImage = productCategory.image;

    Object.assign(productCategory, updateProductCategoryDto);

    const saved = await this.productCategoryRepository.save(productCategory);

    if (
      updateProductCategoryDto.image &&
      previousImage !== updateProductCategoryDto.image
    ) {
      await deleteS3ObjectByUrl(previousImage);
    }

    return saved;
  }

  async remove(id: number): Promise<void> {
    const productCategory = await this.findOne(id);

    if (productCategory.children?.length > 0) {
      throw new ConflictException(
        'Cannot delete a main category that has sub categories. Delete or move its sub categories first.',
      );
    }

    await this.productCategoryRepository.remove(productCategory);
    await deleteS3ObjectByUrl(productCategory.image);
  }

  // Only two levels are allowed: a parent must be a main category
  private async validateParent(parentId: number): Promise<ProductCategory> {
    const parent = await this.productCategoryRepository.findOne({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(
        `Parent category with ID ${parentId} not found`,
      );
    }

    if (parent.parentId !== null) {
      throw new BadRequestException(
        'Parent must be a main category — sub categories cannot have their own sub categories',
      );
    }

    return parent;
  }
}
