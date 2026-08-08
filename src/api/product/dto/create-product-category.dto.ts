import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductCategoryDto {
  @ApiProperty({
    description: 'Name of the product category',
    example: 'Electronics',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the product category',
    example: 'All electronic devices and accessories',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Category image URL',
    example: 'https://bolorko-uploads.fra1.digitaloceanspaces.com/categories/abc123.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    description:
      'Hashtag (without "#") used to match this category during Facebook post sync, e.g. "гарцүнх" for posts tagged "#гарцүнх". Falls back to matching on name when not set.',
    example: 'гарцүнх',
    required: false,
  })
  @IsString()
  @IsOptional()
  hashtagName?: string;

  @ApiProperty({
    description: 'Whether the category is featured',
    example: false,
    required: false,
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiProperty({
    description:
      'Parent (main) category ID. Omit or null for a main category.',
    example: 1,
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return parseInt(value);
  })
  @IsNumber()
  @IsOptional()
  parentId?: number | null;
}
