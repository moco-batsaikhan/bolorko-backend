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
import { StorepayLoan, StorepayLoanStatus } from './entities/storepay-loan.entity';
import {
  CancelStorepayLoanDto,
  CreateStorepayLoanDto,
  StorepayLoanChangeDto,
} from './dto/storepay-loan.dto';
import {
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from '../order/entities/order.entity';

interface StorepayToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class StorepayService {
  private readonly logger = new Logger(StorepayService.name);
  private cachedToken: StorepayToken | null = null;

  constructor(
    @InjectRepository(StorepayLoan)
    private readonly storepayLoanRepository: Repository<StorepayLoan>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.configService
      .get<string>('STOREPAY_BASE_URL', 'https://service.storepay.mn/lend-merchant')
      .replace(/\/$/, '');
  }

  private get authUrl(): string {
    return this.configService.get<string>(
      'STOREPAY_AUTH_URL',
      'https://service.storepay.mn/merchant-uaa/oauth/token',
    );
  }

  private get defaultStoreId(): number | undefined {
    const storeId = this.configService.get<string>('STOREPAY_STORE_ID');
    return storeId ? Number(storeId) : undefined;
  }

  private webhookUrl(): string {
    const domain = this.configService.get<string>(
      'DOMAIN',
      'http://127.0.0.1:3000/',
    );
    return `${domain.replace(/\/$/, '')}/payments/storepay/webhook`;
  }

  /**
   * Oauth2 access token авах, expire болтол кэшлэнэ (7200s)
   */
  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken;
    }

    const username = this.configService.get<string>('STOREPAY_USERNAME');
    const password = this.configService.get<string>('STOREPAY_PASSWORD');
    const appUsername = this.configService.get<string>(
      'STOREPAY_APP_USERNAME',
    );
    const appPassword = this.configService.get<string>(
      'STOREPAY_APP_PASSWORD',
    );

    if (!username || !password || !appUsername || !appPassword) {
      throw new BadRequestException(
        'STOREPAY_USERNAME, STOREPAY_PASSWORD, STOREPAY_APP_USERNAME and STOREPAY_APP_PASSWORD must be configured',
      );
    }

    const basicAuth =
      'Basic ' +
      Buffer.from(`${appUsername}:${appPassword}`).toString('base64');

    try {
      const resp = await axios.post(
        this.authUrl,
        null,
        {
          params: {
            grant_type: 'password',
            username,
            password,
          },
          headers: {
            Authorization: basicAuth,
          },
          timeout: 10000,
        },
      );

      const accessToken = resp.data?.access_token;
      const expiresIn = Number(resp.data?.expires_in ?? 7200);

      if (!accessToken) {
        throw new Error(
          `Access token not found in response: ${JSON.stringify(resp.data)}`,
        );
      }

      this.cachedToken = {
        accessToken,
        // 60 секунд нөөцтэй, эрт шинэчилнэ
        expiresAt: Date.now() + (expiresIn - 60) * 1000,
      };

      return accessToken;
    } catch (err: any) {
      this.cachedToken = null;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        throw new BadRequestException(
          `Storepay token request failed${status ? ` (status ${status})` : ''}: ${JSON.stringify(data ?? err.message)}`,
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

  // Blocks Storepay loan creation when the order contains a product an
  // admin has marked as not payable via installment services
  private async assertInstallmentAllowed(orderId: number): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['orderItems', 'orderItems.product'],
    });
    if (!order) {
      return;
    }

    const blockedNames = (order.orderItems ?? [])
      .map((item) => item.product)
      .filter((product) => product && !product.installmentPaymentAllowed)
      .map((product) => product.name);

    if (blockedNames.length > 0) {
      throw new BadRequestException(
        `Дараах бараанд Storepay үйлчилгээ ашиглах боломжгүй: ${blockedNames.join(', ')}`,
      );
    }
  }

  private handleAxiosError(err: any, action: string): never {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      throw new BadRequestException({
        message: `Storepay ${action} failed`,
        status,
        body: data ?? err.message,
      });
    }
    throw new BadRequestException(err?.message ?? err);
  }

  /**
   * 2. Нэхэмжлэх үүсгэх (POST /merchant/loan)
   */
  async createLoan(dto: CreateStorepayLoanDto, user?: any): Promise<StorepayLoan> {
    const storeId = dto.storeId ?? this.defaultStoreId;
    if (!storeId) {
      throw new BadRequestException(
        'storeId is required (or configure STOREPAY_STORE_ID)',
      );
    }

    if (dto.orderId) {
      await this.assertInstallmentAllowed(dto.orderId);
    }

    const requestId = nanoid();
    const callbackUrl = dto.callbackUrl ?? this.webhookUrl();

    const loan = this.storepayLoanRepository.create({
      requestId,
      orderId: dto.orderId ?? null,
      userId: user?.id ?? null,
      storeId,
      mobileNumber: dto.mobileNumber,
      description: dto.description,
      amount: dto.amount,
      callbackUrl,
      status: StorepayLoanStatus.PENDING,
    });

    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/merchant/loan`,
        {
          storeId,
          mobileNumber: dto.mobileNumber,
          description: dto.description,
          amount: dto.amount,
          callbackUrl,
          requestId,
        },
        { headers, timeout: 10000 },
      );

      const data = resp.data;
      if (data?.status !== 'Success') {
        loan.status = StorepayLoanStatus.FAILED;
        await this.storepayLoanRepository.save(loan);
        throw new BadRequestException({
          message: 'Storepay нэхэмжлэл үүсгэж чадсангүй',
          msgList: data?.msgList,
        });
      }

      loan.loanId = data.value;
      await this.storepayLoanRepository.save(loan);

      this.logger.log(`Storepay loan created: ${loan.loanId}`);
      return loan;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.handleAxiosError(err, 'createLoan');
    }
  }

  /**
   * Захиалгад холбож Storepay нэхэмжлэл үүсгэх
   */
  async createLoanForOrder(
    order: Order,
    mobileNumber: string,
    description?: string,
  ): Promise<StorepayLoan> {
    return this.createLoan(
      {
        mobileNumber,
        description: description ?? `Order #${order.id}`,
        amount: Number(order.total),
        orderId: order.id,
      },
      order.userId ? { id: order.userId } : undefined,
    );
  }

  /**
   * 3. Нэхэмжлэх баталгаажсан эсэхийг шалгах (loanId-аар)
   */
  async checkLoan(loanId: number): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.get(
        `${this.baseUrl}/merchant/loan/check/${loanId}`,
        { headers, timeout: 10000 },
      );
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'checkLoan');
    }
  }

  /**
   * 4. Нэхэмжлэх баталгаажсан эсэхийг шалгах (requestId-аар)
   */
  async checkLoanByRequestId(requestId: string): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.get(
        `${this.baseUrl}/merchant/loan/checkRequest/${requestId}`,
        { headers, timeout: 10000 },
      );
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'checkLoanByRequestId');
    }
  }

  /**
   * 5. Нэхэмжлэх цуцлах
   */
  async cancelLoan(dto: CancelStorepayLoanDto): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/merchant/account/cancel`,
        dto,
        { headers, timeout: 10000 },
      );

      const loan = await this.storepayLoanRepository.findOne({
        where: { loanId: dto.accountId },
      });
      if (loan) {
        loan.status = StorepayLoanStatus.CANCELLED;
        await this.storepayLoanRepository.save(loan);
        if (loan.orderId) {
          await this.applyLoanStatusToOrder(loan.orderId, StorepayLoanStatus.CANCELLED);
        }
      }

      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'cancelLoan');
    }
  }

  /**
   * 6. Нэхэмжлэлийн жагсаалт
   */
  async listLoans(startDate: string, endDate: string): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.get(
        `${this.baseUrl}/merchant/loanList/${startDate}/${endDate}`,
        { headers, timeout: 10000 },
      );
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'listLoans');
    }
  }

  /**
   * 7. Зээлийн дүн солих / баталгаажсан нэхэмжлэл цуцлах хүсэлт илгээх
   */
  async requestLoanChange(dto: StorepayLoanChangeDto): Promise<any> {
    if (dto.changeTypeId === 1 && dto.amount === undefined) {
      throw new BadRequestException(
        'amount is required when changeTypeId = 1',
      );
    }

    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/merchant/loanChange`,
        dto,
        { headers, timeout: 10000 },
      );
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'requestLoanChange');
    }
  }

  /**
   * 8. Зээлийн дүн солих / цуцлах хүсэлтийн жагсаалт
   */
  async listLoanChangeRequests(): Promise<any> {
    try {
      const headers = await this.authHeaders();
      const resp = await axios.post(
        `${this.baseUrl}/merchant/ds/dtable`,
        { code: 'MerchantLoanChangeList' },
        { headers, timeout: 10000 },
      );
      return resp.data;
    } catch (err: any) {
      this.handleAxiosError(err, 'listLoanChangeRequests');
    }
  }

  /**
   * Storepay callbackUrl-аар ирэх webhook. ?id={loanId} параметртэй ирнэ.
   * Аюулгүй байдлын үүднээс өөрсдөө loanId-г ашиглан баталгаажсан эсэхийг
   * давхар шалгана.
   */
  async handleWebhook(loanId: number): Promise<any> {
    const checkResult = await this.checkLoan(loanId);
    const isConfirmed = checkResult?.value === true;

    const loan = await this.storepayLoanRepository.findOne({
      where: { loanId },
    });

    if (!loan) {
      throw new NotFoundException(`Storepay loan not found: ${loanId}`);
    }

    loan.status = isConfirmed
      ? StorepayLoanStatus.CONFIRMED
      : StorepayLoanStatus.PENDING;
    if (isConfirmed) {
      loan.confirmedAt = new Date();
    }
    await this.storepayLoanRepository.save(loan);

    if (loan.orderId) {
      await this.applyLoanStatusToOrder(loan.orderId, loan.status);
    }

    return { loanId, status: loan.status };
  }

  private async applyLoanStatusToOrder(
    orderId: number,
    loanStatus: StorepayLoanStatus,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`Order ${orderId} linked to Storepay loan not found`);
      return;
    }

    if (loanStatus === StorepayLoanStatus.CONFIRMED) {
      order.paymentStatus = OrderPaymentStatus.PAID;
      if (order.status === OrderStatus.PENDING) {
        order.status = OrderStatus.PAID;
      }
    } else if (loanStatus === StorepayLoanStatus.CANCELLED) {
      order.paymentStatus = OrderPaymentStatus.FAILED;
    }

    await this.orderRepository.save(order);
  }

  async findByRequestId(requestId: string): Promise<StorepayLoan> {
    const loan = await this.storepayLoanRepository.findOne({
      where: { requestId },
    });
    if (!loan) {
      throw new NotFoundException(
        `Storepay loan with requestId ${requestId} not found`,
      );
    }
    return loan;
  }
}
