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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '../user/entities/user-role.entity';
import { ParseFormDataPipe } from '../../common/pipes/parse-form-data.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { createS3Storage } from '../../common/storage/s3-storage';

const bannerImageStorage = createS3Storage(
  'banners',
  /^image\/(jpg|jpeg|png|gif|webp)$/,
);

@ApiTags('Banners')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FileInterceptor('image', bannerImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create banner with image upload',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          example: 'Summer Sale',
        },
        description: {
          type: 'string',
          example: 'Up to 50% off on all products',
        },
        link: {
          type: 'string',
          example: '/products/1',
        },
        sortOrder: {
          type: 'number',
          example: 1,
        },
        isActive: {
          type: 'boolean',
          example: true,
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file (jpg, jpeg, png, gif, webp)',
        },
      },
      required: ['title'],
    },
  })
  @ApiOperation({ summary: 'Create a new banner with image upload' })
  @ApiResponse({ status: 201, description: 'Banner created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(
    @Body(ParseFormDataPipe) createBannerDto: CreateBannerDto,
    @UploadedFile() file?: Express.MulterS3.File,
  ) {
    if (file) {
      createBannerDto.image = file.location;
    }
    return this.bannerService.create(createBannerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all banners' })
  @ApiResponse({ status: 200, description: 'Banners retrieved successfully' })
  findAll() {
    return this.bannerService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active banners' })
  @ApiResponse({
    status: 200,
    description: 'Active banners retrieved successfully',
  })
  findActive() {
    return this.bannerService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get banner by ID' })
  @ApiResponse({ status: 200, description: 'Banner retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @UseInterceptors(FileInterceptor('image', bannerImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update banner with image upload',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          example: 'Summer Sale',
        },
        description: {
          type: 'string',
          example: 'Up to 50% off on all products',
        },
        link: {
          type: 'string',
          example: '/products/1',
        },
        sortOrder: {
          type: 'number',
          example: 1,
        },
        isActive: {
          type: 'boolean',
          example: true,
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file (jpg, jpeg, png, gif, webp)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update banner with image upload' })
  @ApiResponse({ status: 200, description: 'Banner updated successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ParseFormDataPipe) updateBannerDto: UpdateBannerDto,
    @UploadedFile() file?: Express.MulterS3.File,
  ) {
    if (file) {
      updateBannerDto.image = file.location;
    }
    return this.bannerService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Delete banner' })
  @ApiResponse({ status: 200, description: 'Banner deleted successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.remove(id);
  }
}
