import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import axios from 'axios';
import {
  Product,
  ProductPostType,
  ProductStatus,
} from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { uploadBufferToSpaces } from '../../common/storage/s3-storage';

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
  private syncInProgress = false;

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepository: Repository<ProductCategory>,
    private readonly configService: ConfigService,
  ) {}

  // Runs on its own schedule in addition to the manual /sync-facebook
  // endpoint. Silently no-ops when Facebook isn't configured so it doesn't
  // spam the logs on environments that don't use this integration.
  @Cron(CronExpression.EVERY_30_MINUTES)
  async autoSyncPosts(): Promise<void> {
    const pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    const accessToken = this.configService.get<string>(
      'FACEBOOK_PAGE_ACCESS_TOKEN',
    );
    if (!pageId || !accessToken) {
      return;
    }

    try {
      await this.syncPosts();
    } catch (error) {
      this.logger.error(
        `Scheduled Facebook sync failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // Validates config/in-progress state synchronously and kicks off the sync
  // without waiting for it to finish, so callers behind a request proxy with
  // a fixed upstream timeout (e.g. DigitalOcean App Platform) don't 504 on
  // pages with many posts/images to process.
  triggerSync(): { message: string } {
    if (this.syncInProgress) {
      throw new ServiceUnavailableException('Facebook sync is already running');
    }

    const pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    const accessToken = this.configService.get<string>(
      'FACEBOOK_PAGE_ACCESS_TOKEN',
    );
    if (!pageId || !accessToken) {
      throw new ServiceUnavailableException(
        'FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be configured',
      );
    }

    this.syncPosts().catch((error) => {
      this.logger.error(
        `Facebook sync failed: ${error instanceof Error ? error.message : error}`,
      );
    });

    return { message: 'Facebook sync started' };
  }

  async syncPosts(): Promise<FacebookSyncResult> {
    if (this.syncInProgress) {
      throw new ServiceUnavailableException('Facebook sync is already running');
    }

    const pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
    const accessToken = this.configService.get<string>(
      'FACEBOOK_PAGE_ACCESS_TOKEN',
    );

    if (!pageId || !accessToken) {
      throw new ServiceUnavailableException(
        'FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be configured',
      );
    }

    this.syncInProgress = true;
    try {
      const posts = await this.fetchAllPosts(pageId, accessToken);
      const categories = await this.productCategoryRepository.find();

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
          // Only re-fetch images when they haven't been mirrored to Spaces
          // yet — avoids re-downloading/re-uploading on every sync tick.
          await this.applyPostToProduct(
            existing,
            post,
            this.needsImageMigration(existing),
          );
          await this.productRepository.save(existing);
          result.updated++;
        } else {
          const product = this.productRepository.create({
            facebookPostId: post.id,
            stock: 0,
            status: ProductStatus.ACTIVE,
          });
          const matchedCategory = this.matchCategory(post.message, categories);
          if (matchedCategory) {
            product.categoryId = matchedCategory.id;
          }
          await this.applyPostToProduct(product, post, true);
          await this.productRepository.save(product);
          result.created++;
        }
      }

      this.logger.log(
        `Facebook sync finished: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped (of ${result.total} posts)`,
      );

      return result;
    } finally {
      this.syncInProgress = false;
    }
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

  // Match already-synced Facebook posts to a category by hashtag/text,
  // backfill colors/sizes from their "Өнгө:"/"Размер:" sections (for posts
  // synced before those fields existed), then strip hashtags out of the
  // stored description now that they've served their purpose. Only fills
  // in values that are currently unset — never clears/overwrites an
  // existing (e.g. manually set) categoryId/colors/sizes.
  async reclassifyCategories(): Promise<{
    total: number;
    categorized: number;
    uncategorized: number;
    colorsSet: number;
    sizesSet: number;
    hashtagsStripped: number;
  }> {
    const categories = await this.productCategoryRepository.find();
    const synced = await this.productRepository.find({
      where: { facebookPostId: Not(IsNull()) },
    });

    const toUpdate = new Set<Product>();
    let categorized = 0;
    let colorsSet = 0;
    let sizesSet = 0;
    let hashtagsStripped = 0;

    for (const product of synced) {
      const message = product.description ?? '';

      const matchedCategory = this.matchCategory(message, categories);
      if (matchedCategory && product.categoryId !== matchedCategory.id) {
        product.categoryId = matchedCategory.id;
        toUpdate.add(product);
        categorized++;
      }

      if (!product.colors || product.colors.length === 0) {
        const colors = this.extractListSection(message, 'Өнгө');
        if (colors.length > 0) {
          product.colors = colors;
          toUpdate.add(product);
          colorsSet++;
        }
      }

      if (!product.sizes || product.sizes.length === 0) {
        const sizes = this.extractListSection(message, 'Размер');
        if (sizes.length > 0) {
          product.sizes = sizes;
          toUpdate.add(product);
          sizesSet++;
        }
      }

      const cleanedDescription = this.stripHashtags(message);
      if (cleanedDescription !== message) {
        product.description = cleanedDescription;
        toUpdate.add(product);
        hashtagsStripped++;
      }
    }

    if (toUpdate.size > 0) {
      await this.productRepository.save([...toUpdate]);
    }

    return {
      total: synced.length,
      categorized,
      uncategorized: synced.length - categorized,
      colorsSet,
      sizesSet,
      hashtagsStripped,
    };
  }

  // Category names don't contain '#'/spaces the way hashtags are written, so
  // both sides are normalized (lowercased, spaces/punctuation stripped)
  // before comparing, e.g. "Гар цүнх" ~ "#гарцүнх".
  private normalizeHashtagToken(text: string): string {
    return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  private extractHashtags(message: string): string[] {
    const matches = message.match(/#[^\s#]+/gu) ?? [];
    return matches.map((tag) => this.normalizeHashtagToken(tag.slice(1)));
  }

  // Individual (Cyrillic-aware) words in the message, lowercased — used to
  // check whether a category's name is mentioned in plain text, not just
  // as a hashtag.
  private extractWords(message: string): string[] {
    return message.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  }

  private matchCategory(
    message: string,
    categories: ProductCategory[],
  ): ProductCategory | null {
    const hashtags = this.extractHashtags(message);

    // Pass 0: admin-defined hashtagName — explicit mapping takes priority
    // over the name-derived matching below.
    if (hashtags.length > 0) {
      for (const category of categories) {
        if (!category.hashtagName) {
          continue;
        }
        const normalizedHashtagName = this.normalizeHashtagToken(
          category.hashtagName,
        );
        if (
          normalizedHashtagName &&
          hashtags.some(
            (tag: string) =>
              tag === normalizedHashtagName ||
              tag.includes(normalizedHashtagName),
          )
        ) {
          return category;
        }
      }
    }

    // Pass 1: hashtag match derived from category name (strongest signal
    // when hashtagName isn't set)
    if (hashtags.length > 0) {
      for (const category of categories) {
        const normalizedName = this.normalizeHashtagToken(category.name);
        if (!normalizedName) {
          continue;
        }
        if (
          hashtags.some(
            (tag: string) =>
              tag === normalizedName || tag.includes(normalizedName),
          )
        ) {
          return category;
        }
      }
    }

    // Pass 2: plain-text match — every word of a (possibly multi-word)
    // category name must be a prefix of some word in the description, e.g.
    // "Гар цүнх" needs both "гар"/"гар..." and "цүнх"/"цүнх..." present.
    // Prefix (not exact) match because Mongolian nouns take case suffixes
    // in running text (e.g. "чимэглэлийн", "цүнхтэй").
    const words = this.extractWords(message);
    if (words.length > 0) {
      for (const category of categories) {
        const nameWords = category.name
          .toLowerCase()
          .match(/[\p{L}\p{N}]+/gu);
        if (!nameWords || nameWords.length === 0) {
          continue;
        }
        const allPresent = nameWords.every((nameWord) =>
          words.some((word) => word.startsWith(nameWord)),
        );
        if (allPresent) {
          return category;
        }
      }
    }

    return null;
  }

  // Removes hashtags from post text and tidies up the whitespace left
  // behind (collapsed blank lines/runs of spaces from the removal).
  private stripHashtags(message: string): string {
    return message
      .replace(/#[^\s#]+/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // A post is a product ad when it mentions a price or carries a "зар" hashtag
  private classifyMessage(message: string): ProductPostType {
    const hasPrice = this.extractPrice(message) !== null;
    const hasSaleHashtag = /#[^\s#]*зар/iu.test(message);
    return hasPrice || hasSaleHashtag
      ? ProductPostType.PRODUCT
      : ProductPostType.INFO;
  }

  private async applyPostToProduct(
    product: Product,
    post: FacebookPost,
    migrateImages: boolean,
  ): Promise<void> {
    const rawMessage = post.message!.trim();
    // Hashtags are only useful for classification (postType/category) — not
    // worth keeping in the stored description
    const message = this.stripHashtags(rawMessage);

    product.name = this.extractName(message);
    product.description = message;
    product.postType = this.classifyMessage(rawMessage);
    if (migrateImages) {
      product.images = await this.migrateImagesToSpaces(post);
    }
    product.permalinkUrl = post.permalink_url ?? null;
    product.postedAt = post.created_time ? new Date(post.created_time) : null;
    product.lastSyncedAt = new Date();
    product.stock = product.stock ?? 5; // Preserve existing stock if already set

    const colors = this.extractListSection(message, 'Өнгө');
    if (colors.length > 0) {
      product.colors = colors;
    }
    const sizes = this.extractListSection(message, 'Размер');
    if (sizes.length > 0) {
      product.sizes = sizes;
    }

    const price = this.extractPrice(message);
    if (price !== null) {
      product.price = price;
    } else if (product.price === undefined || product.price === null) {
      product.price = 0;
    }

    // Low-value/priceless posts aren't worth financing — no price or under
    // 100,000₮ defaults to installment payment (Storepay/Pocket) disabled
    product.installmentPaymentAllowed = Number(product.price) >= 100000;
  }

  // True when the product has no images yet, or still points at Facebook's
  // own CDN (either never migrated, or synced before this feature existed).
  private needsImageMigration(product: Product): boolean {
    const images = product.images ?? [];
    return (
      images.length === 0 ||
      images.some(
        (url) => url.includes('fbcdn.net') || /\bfacebook\.com\b/.test(url),
      )
    );
  }

  // Downloads each Facebook-hosted image and re-uploads it to our own
  // Spaces bucket, so product images don't depend on Facebook CDN links
  // that can expire or change. Falls back to the original CDN URL for any
  // image that fails to mirror, rather than silently dropping it.
  private async migrateImagesToSpaces(post: FacebookPost): Promise<string[]> {
    const sourceUrls = this.extractImages(post);

    return Promise.all(
      sourceUrls.map(async (src) => {
        try {
          const response = await axios.get(src, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          const contentType: string =
            response.headers['content-type'] || 'image/jpeg';
          const extension = contentType.includes('png')
            ? '.png'
            : contentType.includes('webp')
              ? '.webp'
              : '.jpg';

          return await uploadBufferToSpaces(
            'facebook',
            Buffer.from(response.data),
            contentType,
            extension,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to mirror Facebook image to Spaces, keeping original CDN link (${src}): ${
              error instanceof Error ? error.message : error
            }`,
          );
          return src;
        }
      }),
    );
  }

  // Parses a labeled section out of the post text, e.g.:
  //   Өнгө:
  //   • Хөх
  //
  //   Размер:
  //   S, M, L
  // Items may be bullet lines ("• Хөх") and/or comma-separated on one line
  // ("S, M, L"); the section ends at the next blank line, the next known
  // label, or the end of the message.
  private extractListSection(message: string, label: string): string[] {
    const pattern = new RegExp(
      `${label}\\s*:\\s*\\n?([\\s\\S]*?)(?:\\n\\s*\\n|\\n\\s*(?:Өнгө|Размер)\\s*:|$)`,
      'iu',
    );
    const match = message.match(pattern);
    if (!match) {
      return [];
    }

    return match[1]
      .split(/[,\n]/)
      .map((item) => item.replace(/^[\s•\-*]+/, '').trim())
      .filter((item) => item.length > 0);
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
