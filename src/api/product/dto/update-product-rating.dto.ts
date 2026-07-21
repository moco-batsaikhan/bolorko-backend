import { PartialType } from '@nestjs/swagger';
import { CreateProductRatingDto } from './create-product-rating.dto';

export class UpdateProductRatingDto extends PartialType(
  CreateProductRatingDto,
) {}
