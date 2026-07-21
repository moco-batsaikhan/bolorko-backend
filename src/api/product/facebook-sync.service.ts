import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import axios from 'axios';
import {
  Product,
  ProductPostType,
  ProductStatus,
} from './entities/product.entity';

interface FacebookMedia {
  image?: { src: string };
}

interface FacebookAttachment {
  media_type?: string;
  media?: FacebookMedia;
  subattachments?: { data: FacebookAttachment[] };
}

interface FacebookPost {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: { data: FacebookAttachment[] };
}

export interface FacebookSyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly configService: ConfigService,
  ) {}

  async syncPosts(): Promise<FacebookSyncResult> {
    const pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    const accessToken = this.configService.get<string>(
      'FACEBOOK_PAGE_ACCESS_TOKEN',
    );

    if (!pageId || !accessToken) {
      throw new ServiceUnavailableException(
        'FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be configured',
      );
    }

    const posts = await this.fetchAllPosts(pageId, accessToken);

    const result: FacebookSyncResult = {
      total: posts.length,
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const post of posts) {
      // Skip posts without text — nothing to build a product from
      if (!post.message?.trim()) {
        result.skipped++;
        continue;
      }

      const existing = await this.productRepository.findOne({
        where: { facebookPostId: post.id },
      });

      if (existing) {
        this.applyPostToProduct(existing, post);
        await this.productRepository.save(existing);
        result.updated++;
      } else {
        const product = this.productRepository.create({
          facebookPostId: post.id,
          stock: 0,
          status: ProductStatus.ACTIVE,
        });
        this.applyPostToProduct(product, post);
        await this.productRepository.save(product);
        result.created++;
      }
    }

    this.logger.log(
      `Facebook sync finished: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped (of ${result.total} posts)`,
    );

    return result;
  }

  private async fetchAllPosts(
    pageId: string,
    accessToken: string,
  ): Promise<FacebookPost[]> {
    const version = this.configService.get<string>(
      'FACEBOOK_GRAPH_API_VERSION',
      'v23.0',
    );
    const fields = [
      'id',
      'message',
      'created_time',
      'permalink_url',
      'full_picture',
      'attachments{media_type,media{image{src}},subattachments{media{image{src}}}}',
    ].join(',');

    const posts: FacebookPost[] = [];
    let url: string | undefined =
      `https://graph.facebook.com/${version}/${pageId}/posts`;
    let params: Record<string, string> | undefined = {
      fields,
      limit: '100',
      access_token: accessToken,
    };

    // Follow pagination, capped to avoid unbounded fetches on large pages
    const maxPages = 10;
    for (let page = 0; page < maxPages && url; page++) {
      try {
        const response = await axios.get(url, { params });
        posts.push(...(response.data?.data ?? []));
        url = response.data?.paging?.next;
        params = undefined; // "next" URL already contains all query params
      } catch (error) {
        const fbError = axios.isAxiosError(error)
          ? error.response?.data?.error?.message
          : undefined;
        this.logger.error(`Facebook Graph API request failed: ${fbError}`);
        throw new ServiceUnavailableException(
          `Facebook Graph API request failed${fbError ? `: ${fbError}` : ''}`,
        );
      }
    }

    return posts;
  }

  // Reclassify already-saved Facebook posts with the current rules
  async reclassifyExisting(): Promise<{
    total: number;
    products: number;
    info: number;
  }> {
    const synced = await this.productRepository.find({
      where: { facebookPostId: Not(IsNull()) },
    });

    let products = 0;
    let info = 0;

    for (const product of synced) {
      product.postType = this.classifyMessage(product.description ?? '');
      if (product.postType === ProductPostType.PRODUCT) {
        products++;
      } else {
        info++;
      }
    }

    await this.productRepository.save(synced);

    return { total: synced.length, products, info };
  }

  // A post is a product ad when it mentions a price or carries a "зар" hashtag
  private classifyMessage(message: string): ProductPostType {
    const hasPrice = this.extractPrice(message) !== null;
    const hasSaleHashtag = /#[^\s#]*зар/iu.test(message);
    return hasPrice || hasSaleHashtag
      ? ProductPostType.PRODUCT
      : ProductPostType.INFO;
  }

  private applyPostToProduct(product: Product, post: FacebookPost): void {
    const message = post.message!.trim();

    product.name = this.extractName(message);
    product.description = message;
    product.postType = this.classifyMessage(message);
    product.images = this.extractImages(post);
    product.permalinkUrl = post.permalink_url ?? null;
    product.postedAt = post.created_time ? new Date(post.created_time) : null;
    product.lastSyncedAt = new Date();

    const price = this.extractPrice(message);
    if (price !== null) {
      product.price = price;
    } else if (product.price === undefined || product.price === null) {
      product.price = 0;
    }
  }

  // First non-empty line of the post, truncated to fit varchar(255)
  private extractName(message: string): string {
    const firstLine =
      message
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? message;
    return firstLine.length > 255 ? `${firstLine.slice(0, 252)}...` : firstLine;
  }

  private extractImages(post: FacebookPost): string[] {
    const images: string[] = [];

    for (const attachment of post.attachments?.data ?? []) {
      if (attachment.subattachments?.data?.length) {
        for (const sub of attachment.subattachments.data) {
          if (sub.media?.image?.src) {
            images.push(sub.media.image.src);
          }
        }
      } else if (attachment.media?.image?.src) {
        images.push(attachment.media.image.src);
      }
    }

    if (images.length === 0 && post.full_picture) {
      images.push(post.full_picture);
    }

    return images;
  }

  // Parse price from post text: "Үнэ: 85,000₮", "85'000 төгрөг", "85000₮" ...
  private extractPrice(message: string): number | null {
    const patterns = [
      /үнэ\s*[:\-]?\s*([\d]{1,3}(?:[,.'\s][\d]{3})*|\d+)/iu,
      /([\d]{1,3}(?:[,.'\s][\d]{3})*|\d+)\s*(?:₮|mnt|төг(?:рөг)?)/iu,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const price = parseInt(match[1].replace(/[^\d]/g, ''), 10);
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }

    return null;
  }
}
