import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductRatingDto {
  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Optional comment for the rating',
    example: 'Great product, highly recommended!',
    required: false,
  })
  @IsString()
  @IsOptional()
  comment?: string;
}
