import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Invoice } from './entities/invoice.entity';
import axios from 'axios';
import { InvoiceDto } from './dto/invoice.dto';
import { nanoid } from 'nanoid';
import {
  Order,
  OrderStatus,
  OrderPaymentStatus,
} from '../order/entities/order.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {}

  private get qpayBaseUrl(): string {
    return this.configService.get<string>(
      'QPAY_BASE_URL',
      'https://merchant.qpay.mn',
    );
  }

  private get qpayInvoiceCode(): string {
    return this.configService.get<string>('QPAY_INVOICE_CODE', '');
  }

  async createInvoice(invoiceDto: InvoiceDto, user: any) {
    const invoiceId = `MEGA-${nanoid()}`;

    const invoice = this.invoiceRepository.create({
      invoiceId,
      userId: user?.id ?? null,
      orderId: invoiceDto.orderId ?? null,
      amount: invoiceDto.amount ?? null,
      redirectUrl: invoiceDto.redirectUrl ?? null,
      email: invoiceDto.email ?? null,
      productName: invoiceDto.productName ?? null,
    });

    const token = await this.getToken();
    const qpayResp = await this.createQpayInvoice(token, invoice);

    invoice.status = 'PENDING';
    invoice.qpayInvoiceId = qpayResp.invoice_id;

    await this.invoiceRepository.save(invoice);

    return { ...invoice, qpayData: qpayResp };
  }

  /**
   * Create an invoice for an order and link them (used by POST /orders)
   */
  async createInvoiceForOrder(order: Order, email?: string) {
    return await this.createInvoice(
      {
        orderId: order.id,
        amount: Number(order.total),
        productName: `Order #${order.id}`,
        email,
        redirectUrl: this.callbackUrl(),
      },
      order.userId ? { id: order.userId } : null,
    );
  }

  // QPay calls this URL with ?qpay_payment_id=... appended
  private callbackUrl(): string {
    const domain = this.configService.get<string>(
      'DOMAIN',
      'http://127.0.0.1:3000/',
    );
    return `${domain.replace(/\/$/, '')}/payments/qpay/callback`;
  }

  /**
   * Create invoice in QPay using Bearer token and request DTO
   */
  async createQpayInvoice(token: string, dto: Invoice): Promise<any> {
    try {
      const body = {
        sender_invoice_no: dto.invoiceId,
        sender_branch_code: this.qpayInvoiceCode,
        invoice_code: this.qpayInvoiceCode,
        invoice_receiver_code: '1',
        amount: dto.amount,
        callback_url: dto.redirectUrl ?? this.callbackUrl(),
        invoice_description: dto.productName,
      };

      const resp = await axios.post(`${this.qpayBaseUrl}/v2/invoice`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      this.logger.log(`QPay invoice created: ${resp.data?.invoice_id}`);

      return resp.data;
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        throw new BadRequestException({
          status,
          body: data,
          message: err.message,
        });
      }

      throw new BadRequestException(err?.message ?? err);
    }
  }

  /**
   * Handle QPay webhook callback for invoice payment.
   * Retrieves payment status from QPay, updates the invoice and,
   * when the invoice is linked to an order, the order as well.
   */
  async invoiceWebhookQPay(qpayPaymentId: string): Promise<any> {
    if (!qpayPaymentId) {
      throw new BadRequestException('qpay_payment_id is required');
    }

    try {
      const qPayInvoiceResult = await this.isSuccessQPayInvoice(qpayPaymentId);

      let status = qPayInvoiceResult.payment_status;
      if (status === 'NEW') {
        status = 'PENDING';
      }

      const invoice = await this.invoiceRepository.findOne({
        where: { qpayInvoiceId: qPayInvoiceResult.object_id },
      });

      if (!invoice) {
        throw new NotFoundException(
          `Invoice not found for payment ID: ${qpayPaymentId}`,
        );
      }

      invoice.status = status;
      if (status === 'PAID') {
        invoice.paidAt = new Date();
      }

      await this.invoiceRepository.save(invoice);

      if (invoice.orderId) {
        await this.applyInvoiceStatusToOrder(invoice.orderId, status);
      }

      return { invoiceId: invoice.invoiceId, status };
    } catch (err: any) {
      this.logger.error(`Webhook processing error: ${err.message}`);
      throw new BadRequestException({
        success: false,
        message: 'Failed to process payment webhook',
        error: err.message,
      });
    }
  }

  private async applyInvoiceStatusToOrder(
    orderId: number,
    invoiceStatus: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`Order ${orderId} linked to invoice not found`);
      return;
    }

    if (invoiceStatus === 'PAID') {
      order.paymentStatus = OrderPaymentStatus.PAID;
      if (order.status === OrderStatus.PENDING) {
        order.status = OrderStatus.PAID;
      }
    } else if (invoiceStatus === 'FAILED') {
      order.paymentStatus = OrderPaymentStatus.FAILED;
    }

    await this.orderRepository.save(order);
  }

  /**
   * Get payment status from QPay API
   */
  private async isSuccessQPayInvoice(qpayPaymentId: string): Promise<any> {
    try {
      const token = await this.getToken();

      const resp = await axios.get(
        `${this.qpayBaseUrl}/v2/payment/${qpayPaymentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      return resp.data;
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        throw new Error(
          `Failed to fetch payment status${status ? ` (status ${status})` : ''}: ${JSON.stringify(data ?? err.message)}`,
        );
      }
      throw err;
    }
  }

  private async getToken(): Promise<string> {
    const username = this.configService.get<string>('QPAY_CLIENT_ID');
    const password = this.configService.get<string>('QPAY_CLIENT_SECRET');

    if (!username || !password) {
      throw new BadRequestException(
        'QPAY_CLIENT_ID and QPAY_CLIENT_SECRET must be configured',
      );
    }

    const auth =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const resp = await axios.post(
        `${this.qpayBaseUrl}/v2/auth/token`,
        {},
        {
          headers: {
            Authorization: auth,
          },
          timeout: 10000,
        },
      );

      const parsed = resp.data ?? {};
      const token =
        parsed.access_token ??
        parsed.token ??
        parsed.data?.access_token ??
        null;

      if (!token) {
        throw new Error(
          `Token not found in response: ${JSON.stringify(parsed)}`,
        );
      }

      return token;
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        throw new Error(
          `Token request failed${status ? ` (status ${status})` : ''}: ${JSON.stringify(data ?? err.message)}`,
        );
      }
      throw err;
    }
  }

  async checkPaymentStatus(invoiceId: string): Promise<any> {
    const invoice = await this.invoiceRepository.findOne({
      where: { invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    return {
      invoiceId: invoice.invoiceId,
      orderId: invoice.orderId,
      status: invoice.status,
      paidAt: invoice.paidAt,
    };
  }
}
