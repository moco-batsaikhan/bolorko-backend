import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UsePipes,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductPostType } from './entities/product.entity';
import { ProductService } from './product.service';
import { ProductCategoryService } from './product-category.service';
import { FacebookSyncService } from './facebook-sync.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { CreateProductRatingDto } from './dto/create-product-rating.dto';
import { UpdateProductRatingDto } from './dto/update-product-rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '../user/entities/user-role.entity';
import { ParseFormDataPipe } from '../../common/pipes/parse-form-data.pipe';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { createS3Storage } from '../../common/storage/s3-storage';

const categoryImageStorage = createS3Storage(
  'categories',
  /^image\/(jpg|jpeg|png|gif|webp)$/,
);

const productImageStorage = createS3Storage(
  'products',
  /^image\/(jpg|jpeg|png|gif)$/,
);

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productCategoryService: ProductCategoryService,
    private readonly facebookSyncService: FacebookSyncService,
  ) {}

  // Facebook sync endpoint — starts the sync in the background and returns
  // immediately, since a full sync can take longer than the platform's
  // upstream request timeout. Progress/results land in the server logs.
  @Post('sync-facebook')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Start a Facebook page post sync in the background (Graph API)',
  })
  @ApiResponse({
    status: 202,
    description: 'Sync started; runs in the background, results are logged',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 503,
    description:
      'Facebook credentials missing or a sync is already in progress',
  })
  syncFacebook() {
    return this.facebookSyncService.triggerSync();
  }

  // Cleanup endpoint
  @Post('cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({
    summary:
      'Delete products without images and deactivate zero-price products',
  })
  @ApiResponse({
    status: 201,
    description:
      'Cleanup completed: returns deleted/skipped/deactivated counts',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  cleanup() {
    return this.productService.cleanup();
  }

  // Reclassify existing Facebook-synced records
  @Post('classify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({
    summary:
      'Reclassify existing Facebook-synced records into PRODUCT/INFO by price and hashtag rules',
  })
  @ApiResponse({
    status: 201,
    description: 'Classification completed: returns total/products/info counts',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  classify() {
    return this.facebookSyncService.reclassifyExisting();
  }

  // Categorize existing Facebook-synced records by hashtag
  @Post('classify-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({
    summary:
      'Assign a category to existing Facebook-synced records based on hashtags in their text',
  })
  @ApiResponse({
    status: 201,
    description:
      'Categorization completed: returns total/categorized/uncategorized counts',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  classifyCategories() {
    return this.facebookSyncService.reclassifyCategories();
  }

  // Product endpoints
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 10, productImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create product with multiple image uploads',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'iPhone 13 Pro',
        },
        description: {
          type: 'string',
          example: 'Latest iPhone with advanced camera system',
        },
        price: {
          type: 'number',
          example: 999.99,
        },
        salePrice: {
          type: 'number',
          example: 799.99,
          nullable: true,
        },
        stock: {
          type: 'number',
          example: 50,
        },
        categoryId: {
          type: 'number',
          example: 1,
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
          example: 'ACTIVE',
        },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Multiple product image files (jpg, jpeg, png, gif)',
        },
      },
      required: ['name', 'description', 'price', 'stock'],
    },
  })
  @ApiOperation({ summary: 'Create a new product with multiple image uploads' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(
    @Body(ParseFormDataPipe) createProductDto: CreateProductDto,
    @UploadedFiles() files?: Express.MulterS3.File[],
  ) {
    if (files && files.length > 0) {
      createProductDto.images = files.map((file) => file.location);
    }
    return this.productService.create(createProductDto);
  }

  @Get()
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Get all products, optionally filtered by type, category and text search',
  })
  @ApiQuery({
    name: 'type',
    enum: ProductPostType,
    required: false,
    description: 'Filter by post type: PRODUCT (ads) or INFO (announcements)',
  })
  @ApiQuery({
    name: 'categoryId',
    type: Number,
    required: false,
    description:
      'Filter by category. A main category also includes products of its sub categories.',
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search text matched against product name and description',
  })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  findAll(
    @Query('type') type?: string,
    @Query('categoryId', new ParseIntPipe({ optional: true }))
    categoryId?: number,
    @Query('search') search?: string,
  ) {
    return this.productService.findAll(type, categoryId, search);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured active products' })
  @ApiResponse({
    status: 200,
    description: 'Featured products retrieved successfully',
  })
  findFeatured() {
    return this.productService.findFeatured();
  }

  @Get('category/:categoryId')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get products by category' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  findByCategory(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return this.productService.findByCategory(categoryId);
  }

  // Product Category endpoints - moved before :id to avoid conflicts
  @Get('categories')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all product categories' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  findAllCategories() {
    return this.productCategoryService.findAll();
  }

  @Get('categories/featured')
  @ApiOperation({
    summary: 'Get featured categories with their sub categories nested',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured categories retrieved successfully',
  })
  findFeaturedCategories() {
    return this.productCategoryService.findFeatured();
  }

  @Get('categories/main')
  @ApiOperation({
    summary: 'Get main categories with their sub categories nested',
  })
  @ApiResponse({
    status: 200,
    description: 'Main categories retrieved successfully',
  })
  findMainCategories() {
    return this.productCategoryService.findMain();
  }

  @Get('categories/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOneCategory(@Param('id', ParseIntPipe) id: number) {
    return this.productCategoryService.findOne(id);
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FileInterceptor('image', categoryImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create category with image upload',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Electronics',
        },
        description: {
          type: 'string',
          example: 'All electronic devices and accessories',
        },
        parentId: {
          type: 'number',
          example: 1,
          nullable: true,
        },
        isFeatured: {
          type: 'boolean',
          example: false,
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Category image file (jpg, jpeg, png, gif, webp)',
        },
      },
      required: ['name'],
    },
  })
  @ApiOperation({ summary: 'Create a new product category with image upload' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createCategory(
    @Body(ParseFormDataPipe)
    createProductCategoryDto: CreateProductCategoryDto,
    @UploadedFile() file?: Express.MulterS3.File,
  ) {
    if (file) {
      createProductCategoryDto.image = file.location;
    }
    return this.productCategoryService.create(createProductCategoryDto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FileInterceptor('image', categoryImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update category with image upload',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Electronics',
        },
        description: {
          type: 'string',
          example: 'All electronic devices and accessories',
        },
        parentId: {
          type: 'number',
          example: 1,
          nullable: true,
        },
        isFeatured: {
          type: 'boolean',
          example: true,
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Category image file (jpg, jpeg, png, gif, webp)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update category with image upload' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(ParseFormDataPipe)
    updateProductCategoryDto: UpdateProductCategoryDto,
    @UploadedFile() file?: Express.MulterS3.File,
  ) {
    if (file) {
      updateProductCategoryDto.image = file.location;
    }
    return this.productCategoryService.update(id, updateProductCategoryDto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.productCategoryService.remove(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 10, productImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update product with multiple image uploads',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'iPhone 13 Pro',
        },
        description: {
          type: 'string',
          example: 'Latest iPhone with advanced camera system',
        },
        price: {
          type: 'number',
          example: 999.99,
        },
        salePrice: {
          type: 'number',
          example: 799.99,
          nullable: true,
        },
        stock: {
          type: 'number',
          example: 50,
        },
        categoryId: {
          type: 'number',
          example: 1,
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
          example: 'ACTIVE',
        },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Multiple product image files (jpg, jpeg, png, gif)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update product with multiple image uploads' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles() files?: Express.MulterS3.File[],
  ) {
    if (files && files.length > 0) {
      if (!updateProductDto.images) {
        updateProductDto.images = [];
      }
      // Add new uploaded images to existing images array
      const newImages = files.map((file) => file.location);
      updateProductDto.images = [...updateProductDto.images, ...newImages];
    }
    return this.productService.update(id, updateProductDto);
  }

  @Patch(':id/feature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Mark product as featured' })
  @ApiResponse({ status: 200, description: 'Product featured successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  feature(@Param('id', ParseIntPipe) id: number) {
    return this.productService.setFeatured(id, true);
  }

  @Delete(':id/feature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Remove product from featured' })
  @ApiResponse({ status: 200, description: 'Product unfeatured successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  unfeature(@Param('id', ParseIntPipe) id: number) {
    return this.productService.setFeatured(id, false);
  }

  @Patch(':id/stock/:quantity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Update product stock' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Param('quantity', ParseIntPipe) quantity: number,
  ) {
    return this.productService.updateStock(id, quantity);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Delete product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productService.remove(id);
  }

  // Product Rating endpoints
  @Post(':id/ratings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add rating to product' })
  @ApiResponse({ status: 201, description: 'Rating added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - already rated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  addRating(
    @Param('id', ParseIntPipe) productId: number,
    @Body() createRatingDto: CreateProductRatingDto,
    @Request() req: any,
  ) {
    return this.productService.addRating(
      productId,
      req.user.id,
      createRatingDto,
    );
  }

  @Get(':id/ratings')
  @ApiOperation({ summary: 'Get product ratings' })
  @ApiResponse({ status: 200, description: 'Ratings retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getProductRatings(
    @Param('id', ParseIntPipe) productId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.productService.getProductRatings(productId, page, limit);
  }

  @Patch('ratings/:ratingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update rating' })
  @ApiResponse({ status: 200, description: 'Rating updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your rating' })
  @ApiResponse({ status: 404, description: 'Rating not found' })
  updateRating(
    @Param('ratingId', ParseIntPipe) ratingId: number,
    @Body() updateRatingDto: UpdateProductRatingDto,
    @Request() req: any,
  ) {
    return this.productService.updateRating(
      ratingId,
      req.user.id,
      updateRatingDto,
    );
  }

  @Delete('ratings/:ratingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete rating' })
  @ApiResponse({ status: 200, description: 'Rating deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your rating' })
  @ApiResponse({ status: 404, description: 'Rating not found' })
  deleteRating(
    @Param('ratingId', ParseIntPipe) ratingId: number,
    @Request() req: any,
  ) {
    return this.productService.deleteRating(ratingId, req.user.id);
  }

  // Image management endpoints
  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 10, productImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Add multiple images to product',
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Multiple product image files (jpg, jpeg, png, gif)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Add multiple images to product' })
  @ApiResponse({ status: 200, description: 'Images added successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  addImages(
    @Param('id', ParseIntPipe) productId: number,
    @UploadedFiles() files: Express.MulterS3.File[],
  ) {
    return this.productService.addImages(productId, files);
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Remove specific image from product' })
  @ApiResponse({ status: 200, description: 'Image removed successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  removeImage(
    @Param('id', ParseIntPipe) productId: number,
    @Body() body: { imageUrl: string },
  ) {
    return this.productService.removeImage(productId, body.imageUrl);
  }

  // Product Category endpoints
}
