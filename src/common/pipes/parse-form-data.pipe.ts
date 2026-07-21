import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseFormDataPipe implements PipeTransform {
  transform(value: any) {
    if (!value) return value;

    // Transform numeric string fields to numbers
    const transformed = { ...value };

    if (transformed.price !== undefined) {
      const price = parseFloat(transformed.price);
      if (isNaN(price)) {
        throw new BadRequestException('Price must be a valid number');
      }
      transformed.price = price;
    }

    if (transformed.salePrice !== undefined) {
      if (transformed.salePrice === null || transformed.salePrice === '') {
        transformed.salePrice = null;
      } else {
        const salePrice = parseFloat(transformed.salePrice);
        if (isNaN(salePrice)) {
          throw new BadRequestException('Sale price must be a valid number');
        }
        transformed.salePrice = salePrice;
      }
    }

    if (transformed.stock !== undefined) {
      const stock = parseInt(transformed.stock, 10);
      if (isNaN(stock)) {
        throw new BadRequestException('Stock must be a valid integer');
      }
      transformed.stock = stock;
    }

    if (transformed.categoryId !== undefined) {
      const categoryId = parseInt(transformed.categoryId, 10);
      if (isNaN(categoryId)) {
        throw new BadRequestException('Category ID must be a valid number');
      }
      transformed.categoryId = categoryId;
    }

    if (transformed.sortOrder !== undefined) {
      const sortOrder = parseInt(transformed.sortOrder, 10);
      if (isNaN(sortOrder)) {
        throw new BadRequestException('Sort order must be a valid integer');
      }
      transformed.sortOrder = sortOrder;
    }

    for (const booleanField of ['isActive', 'isFeatured']) {
      if (
        transformed[booleanField] !== undefined &&
        typeof transformed[booleanField] === 'string'
      ) {
        if (
          transformed[booleanField] !== 'true' &&
          transformed[booleanField] !== 'false'
        ) {
          throw new BadRequestException(
            `${booleanField} must be true or false`,
          );
        }
        transformed[booleanField] = transformed[booleanField] === 'true';
      }
    }

    return transformed;
  }
}
