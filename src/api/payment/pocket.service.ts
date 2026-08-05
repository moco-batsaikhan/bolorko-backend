import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { nanoid } from 'nanoid';
import {
  PocketInvoice,
  PocketInvoiceState,
  PocketInvoiceType,
  PocketInvoiceChannel,
} from './entities/pocket-invoice.entity';
import { CreatePocketInvoiceDto } from './dto/pocket-invoice.dto';
import {
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from '../order/entities/order.entity';

interface PocketToken {
  accessToken: string;
  expiresAt: number;
}

interface PocketWebhookPayload {
  id?: number;
  amount?: number;
  info?: string;
  invoiceId?: number;
  invoiceState?: number;
  phoneNumber?: string;
  orderNumber?: string;
}

// API 6: webhook мэдэгдэл invoiceState-г тоон кодоор илгээдэг ба API 3.1/3.2
// нь мөн адилхан төлвүүдийг string-ээр буцаадаг тул нэг тийш нийцүүлэв.
const WEBHOOK_STATE_MAP: Record<number, PocketInvoiceState> = {
  10: PocketInvoiceState.PENDING,
  20: PocketInvoiceState.PAID,
  30: PocketInvoiceState.CANCELLED,
  40: PocketInvoiceState.REJECTED,
  50: PocketInvoiceState.UNSUCCESS,
  60: PocketInvoiceState.PROCESSING,
  70: PocketInvoiceState.PROCESSED,
};

@Injectable()
export class PocketService {
  private readonly logger = new Logger(PocketService.name);
  private cachedToken: PocketToken | null = null;

  constructor(
    @InjectRepository(PocketInvoice)
    private readonly pocketInvoiceRepository: Repository<PocketInvoice>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {}

  // Full token endpoint — kept as one URL rather than schema+host+realm
  // template because the staging (sso-staging.pocket.mn, no /auth prefix)
  // and production (sso.invescore.mn/auth/..., legacy Keycloak path) hosts
  // don't follow the same path shape.
  private get authUrl(): string {
    const url = this.configService.get<string>('POCKET_AUTH_URL');
    if (!url) {
      throw new BadRequestException('POCKET_AUTH_URL must be configured');
    }
    return url;
  }

  private get baseUrl(): string {
    const url = this.configService.get<string>('POCKET_BASE_URL');
    if (!url) {
      throw new BadRequestException('POCKET_BASE_URL must be configured');
    }
    return url.replace(/\/$/, '');
  }

  private get defaultTerminalId(): string | undefined {
    return this.configService.get<string>('POCKET_TERMINAL_ID');
  }

  private webhookUrl(): string {
    const domain = this.configService.get<string>(
      'DOMAIN',
      'http://127.0.0.1:3000/',
    );
    return `${domain.replace(/\/$/, '')}/payments/pocket/webhook`;
  }

  /**
   * 1.1 Client Credentials grant-р токен авах, expire болтол кэшлэнэ.
   */
  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken;
    }

    const clientId = this.configService.get<string>('POCKET_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'POCKET_CLIENT_SECRET',
    );

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'POCKET_CLIENT_ID and POCKET_CLIENT_SECRET must be configured',
      );
    }

    try {
      const resp = await axios.post(
        this.authUrl,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );

      const accessToken = resp.data?.access_token;
      const expiresIn = Number(resp.data?.expires_in ?? 600);

      if (!accessToken) {
        throw new Error(
          `Access token not found in response: ${JSON.stringify(resp.data)}`,
        );
      }

      this.cachedToken = {
        accessToken,
        // 30 секунд нөөцтэй, эрт шинэчилнэ (expires_in ойролцоогоор 600s)
        expiresAt: Date.now() + (expiresIn - 30) * 1000,
      };

      return accessToken;
    } catch (err: any) {
      this.cachedToken = null;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        throw new BadRequestException(
          `Pocket token request failed${status ? ` (status ${status})` : ''}: ${JSON.stringify(data ?? err.message)}`,
        );
      }
      throw err;
    }
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private handleAxiosError(err: any, action: string): never {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      throw new BadRequestException({
        message: `Pocket ${action} failed`,
        status,
        body: data ?? err.message,
      });
    }
    throw new BadRequestException(err?.message ?? err);
  }

  /**
   * 3. Нэхэмжлэх үүсгэх (POST /v2/invoicing/generate-invoice)
   */
  async createInvoice(
    dto: CreatePocketInvoiceDto,
    user?: any,
  ): Promise<PocketInvoice> {
    const terminalId = dto.terminalId
      ? String(dto.terminalId)
      : this.defaultTerminalId;
    if (!terminalId) {
      throw new BadRequestException(
        'terminalId is required (or configure POCKET_TERMINAL_ID)',
      );
    }

    const orderNumber = dto.orderNumber ?? nanoid();
    const invoiceType = dto.invoiceType ?? PocketInvoiceType.ZERO;
    const channel = dto.channel ?? PocketInvoiceChannel.ECOMMERCE;

    const invoice = this.pocketInvoiceRepository.create({
      orderNumber,
      orderId: dto.orderId ?? null,
      userId: user?.id ?? null,
      terminalId,
      amount: dto.amount,
      info: dto.info ?? null,
      invoiceType,
      channel,
      state: PocketInvoiceState.PENDING,
    });

    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/v2/invoicing/generate-invoice`,
        {
          terminalId: Number(terminalId),
          amount: dto.amount,
          info: dto.info,
          orderNumber,
          invoiceType,
          channel,
        },
        { headers, timeout: 10000 },
      );

      const data = resp.data;
      invoice.invoiceId = data.id;
      invoice.qr = data.qr;
      invoice.deeplink = data.deeplink;
      await this.pocketInvoiceRepository.save(invoice);

      this.logger.log(`Pocket invoice created: ${invoice.invoiceId}`);
      return invoice;
    } catch (err: any) {
      this.handleAxiosError(err, 'createInvoice');
    }
  }

  /**
   * Захиалгад холбож Pocket нэхэмжлэл үүсгэх
   */
  async createInvoiceForOrder(order: Order): Promise<PocketInvoice> {
    return this.createInvoice(
      {
        amount: Number(order.total),
        info: `Order #${order.id}`,
        orderNumber: `R${order.id}-${nanoid(8)}`,
        orderId: order.id,
      },
      order.userId ? { id: order.userId } : undefined,
    );
  }

  /**
   * 3.1 Захиалгын дугаараар нэхэмжлэл лавлах
   */
  async checkInvoiceByOrderNumber(orderNumber: string): Promise<any> {
    const invoice = await this.findByOrderNumber(orderNumber);

    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/v2/invoicing/invoices/order-number`,
        { terminalId: Number(invoice.terminalId), orderNumber },
        { headers, timeout: 10000 },
      );

      await this.applyStateToInvoice(invoice, resp.data.state);
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'checkInvoiceByOrderNumber');
    }
  }

  /**
   * 3.2 Нэхэмжлэлийн дугаараар лавлах
   */
  async checkInvoiceById(invoiceId: number, terminalId?: number): Promise<any> {
    const resolvedTerminalId = terminalId
      ? String(terminalId)
      : this.defaultTerminalId;
    if (!resolvedTerminalId) {
      throw new BadRequestException(
        'terminalId is required (or configure POCKET_TERMINAL_ID)',
      );
    }

    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/v2/invoicing/invoices/invoice-id`,
        { terminalId: Number(resolvedTerminalId), invoiceId },
        { headers, timeout: 10000 },
      );

      const invoice = await this.pocketInvoiceRepository.findOne({
        where: { invoiceId },
      });
      if (invoice) {
        await this.applyStateToInvoice(invoice, resp.data.state);
      }

      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'checkInvoiceById');
    }
  }

  /**
   * 6. Webhook хүлээн авах хаягийг Pocket дээр тохируулах (POST /pg/config)
   */
  async configureWebhook(fallBackUrl?: string): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/pg/config`,
        { fallBackUrl: fallBackUrl ?? this.webhookUrl() },
        { headers, timeout: 10000 },
      );
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'configureWebhook');
    }
  }

  /**
   * 6.1 Webhook тохиргооны мэдээлэл авах
   */
  async getWebhookConfig(): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.get(`${this.baseUrl}/pg/config`, {
        headers,
        timeout: 10000,
      });
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'getWebhookConfig');
    }
  }

  /**
   * Pocket-с ирэх webhook мэдэгдэл (тохируулсан fallBackUrl дээр POST
   * хийгдэнэ). Аюулгүй байдлын үүднээс өөрсдөө invoiceId/orderNumber-р
   * дахин лавлах шаардлагагүй — payload дотор ирэх state-г шууд ашиглана,
   * учир нь энэ нь Pocket-ийн серверээс ирж буй итгэмжлэгдсэн мэдэгдэл.
   */
  async handleWebhook(
    payload: PocketWebhookPayload,
  ): Promise<{ orderNumber?: string; state: PocketInvoiceState }> {
    const state = WEBHOOK_STATE_MAP[payload.invoiceState ?? -1];
    if (!state) {
      throw new BadRequestException(
        `Unknown Pocket invoiceState: ${payload.invoiceState}`,
      );
    }

    const invoice = payload.orderNumber
      ? await this.pocketInvoiceRepository.findOne({
          where: { orderNumber: payload.orderNumber },
        })
      : payload.invoiceId
        ? await this.pocketInvoiceRepository.findOne({
            where: { invoiceId: payload.invoiceId },
          })
        : null;

    if (!invoice) {
      throw new NotFoundException(
        `Pocket invoice not found for webhook payload: ${JSON.stringify(payload)}`,
      );
    }

    await this.applyStateToInvoice(invoice, state);

    return { orderNumber: invoice.orderNumber, state };
  }

  private async applyStateToInvoice(
    invoice: PocketInvoice,
    state: PocketInvoiceState,
  ): Promise<void> {
    if (invoice.state === state) {
      return;
    }

    invoice.state = state;
    if (state === PocketInvoiceState.PAID) {
      invoice.paidAt = new Date();
    }
    await this.pocketInvoiceRepository.save(invoice);

    if (invoice.orderId) {
      await this.applyInvoiceStateToOrder(invoice.orderId, state);
    }
  }

  private async applyInvoiceStateToOrder(
    orderId: number,
    state: PocketInvoiceState,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`Order ${orderId} linked to Pocket invoice not found`);
      return;
    }

    if (state === PocketInvoiceState.PAID) {
      order.paymentStatus = OrderPaymentStatus.PAID;
      if (order.status === OrderStatus.PENDING) {
        order.status = OrderStatus.PAID;
      }
    } else if (
      state === PocketInvoiceState.CANCELLED ||
      state === PocketInvoiceState.REJECTED ||
      state === PocketInvoiceState.UNSUCCESS
    ) {
      order.paymentStatus = OrderPaymentStatus.FAILED;
    }

    await this.orderRepository.save(order);
  }

  async findByOrderNumber(orderNumber: string): Promise<PocketInvoice> {
    const invoice = await this.pocketInvoiceRepository.findOne({
      where: { orderNumber },
    });
    if (!invoice) {
      throw new NotFoundException(
        `Pocket invoice with orderNumber ${orderNumber} not found`,
      );
    }
    return invoice;
  }
}
