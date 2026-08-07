import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  Query,
  Next,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { StorepayService } from './storepay.service';
import { PocketService } from './pocket.service';
import { InvoiceDto } from './dto/invoice.dto';
import {
  CancelStorepayLoanDto,
  CreateStorepayLoanDto,
  StorepayLoanChangeDto,
} from './dto/storepay-loan.dto';
import { CreatePocketInvoiceDto } from './dto/pocket-invoice.dto';
import type { Request, Response, NextFunction } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly storepayService: StorepayService,
    private readonly pocketService: PocketService,
  ) {}

  @Post('qpay/invoice')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a QPay invoice (login optional)' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'QPay request failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createQpayInvoice(@Body() invoiceDto: InvoiceDto, @Req() req: Request) {
    return this.paymentService.createInvoice(invoiceDto, (req as any).user);
  }

  @Post('qpay/callback')
  @ApiOperation({ summary: 'QPay webhook callback for payment status' })
  @ApiQuery({ name: 'qpay_payment_id', type: String, required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async qpayCallback(@Query('qpay_payment_id') qpayPaymentId: string) {
    const result = await this.paymentService.invoiceWebhookQPay(qpayPaymentId);
    return { success: true, data: result };
  }

  @Get('qpay/status/:invoiceId')
  @ApiOperation({ summary: 'Check payment status by invoice ID' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  getQpayStatus(@Param('invoiceId') invoiceId: string) {
    return this.paymentService.checkPaymentStatus(invoiceId);
  }

  // Legacy routes kept for backward compatibility

  @Post('invoice')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create invoice (legacy, use POST qpay/invoice)' })
  createInvoice(@Body() invoiceDto: InvoiceDto, @Req() req: Request) {
    return this.paymentService.createInvoice(invoiceDto, (req as any).user);
  }

  @Get('webhook/qpay')
  @ApiOperation({
    summary: 'QPay webhook callback (legacy, use POST qpay/callback)',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async qPayWebhook(
    @Query('qpay_payment_id') qpayPaymentId: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      if (!qpayPaymentId) {
        return res.status(400).json({
          success: false,
          message: 'qpay_payment_id is required',
        });
      }

      const response =
        await this.paymentService.invoiceWebhookQPay(qpayPaymentId);

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err: any) {
      next(err);
    }
  }

  @Get('/check-status/:qpayPaymentId')
  @ApiOperation({
    summary: 'Check payment status (legacy, use GET qpay/status/:invoiceId)',
  })
  async checkPaymentStatus(@Param('qpayPaymentId') qpayPaymentId: string) {
    return await this.paymentService.checkPaymentStatus(qpayPaymentId);
  }

  // Storepay routes

  @Post('storepay/loan')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a Storepay loan (login optional)' })
  @ApiResponse({ status: 201, description: 'Loan created successfully' })
  @ApiResponse({ status: 400, description: 'Storepay request failed' })
  createStorepayLoan(
    @Body() dto: CreateStorepayLoanDto,
    @Req() req: Request,
  ) {
    return this.storepayService.createLoan(dto, (req as any).user);
  }

  @Get('storepay/loan/check/:loanId')
  @ApiOperation({ summary: 'Check whether a Storepay loan is confirmed' })
  checkStorepayLoan(@Param('loanId') loanId: string) {
    return this.storepayService.checkLoan(Number(loanId));
  }

  @Get('storepay/loan/checkRequest/:requestId')
  @ApiOperation({
    summary: 'Check whether a Storepay loan is confirmed by requestId',
  })
  checkStorepayLoanByRequestId(@Param('requestId') requestId: string) {
    return this.storepayService.checkLoanByRequestId(requestId);
  }

  @Post('storepay/loan/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel a Storepay loan' })
  cancelStorepayLoan(@Body() dto: CancelStorepayLoanDto) {
    return this.storepayService.cancelLoan(dto);
  }

  @Get('storepay/loan/list/:startDate/:endDate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List Storepay loans within a date range' })
  listStorepayLoans(
    @Param('startDate') startDate: string,
    @Param('endDate') endDate: string,
  ) {
    return this.storepayService.listLoans(startDate, endDate);
  }

  @Post('storepay/loan/change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Request an amount change or cancellation of a confirmed loan',
  })
  requestStorepayLoanChange(@Body() dto: StorepayLoanChangeDto) {
    return this.storepayService.requestLoanChange(dto);
  }

  @Post('storepay/loan/change-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List Storepay loan change/cancel requests' })
  listStorepayLoanChangeRequests() {
    return this.storepayService.listLoanChangeRequests();
  }

  @Get('storepay/webhook')
  @ApiOperation({ summary: 'Storepay webhook callback for loan confirmation' })
  @ApiQuery({ name: 'id', type: String, required: true })
  async storepayWebhook(@Query('id') loanId: string) {
    const result = await this.storepayService.handleWebhook(Number(loanId));
    return { success: true, data: result };
  }

  // Pocket Payment Gateway routes

  @Post('pocket/invoice')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a Pocket invoice (login optional)' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Pocket request failed' })
  createPocketInvoice(
    @Body() dto: CreatePocketInvoiceDto,
    @Req() req: Request,
  ) {
    return this.pocketService.createInvoice(dto, (req as any).user);
  }

  @Get('pocket/invoice/order-number/:orderNumber')
  @ApiOperation({ summary: 'Look up a Pocket invoice by order number' })
  checkPocketInvoiceByOrderNumber(
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.pocketService.checkInvoiceByOrderNumber(orderNumber);
  }

  @Get('pocket/invoice/id/:invoiceId')
  @ApiOperation({ summary: 'Look up a Pocket invoice by invoice ID' })
  @ApiQuery({ name: 'terminalId', type: String, required: false })
  checkPocketInvoiceById(
    @Param('invoiceId') invoiceId: string,
    @Query('terminalId') terminalId?: string,
  ) {
    return this.pocketService.checkInvoiceById(
      Number(invoiceId),
      terminalId ? Number(terminalId) : undefined,
    );
  }

  @Post('pocket/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Register our webhook URL with Pocket (admin/setup use)',
  })
  configurePocketWebhook(@Body('fallBackUrl') fallBackUrl?: string) {
    return this.pocketService.configureWebhook(fallBackUrl);
  }

  @Get('pocket/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the currently configured Pocket webhook URL' })
  getPocketWebhookConfig() {
    return this.pocketService.getWebhookConfig();
  }

  @Post('pocket/webhook')
  @ApiOperation({ summary: 'Pocket webhook callback for invoice status' })
  async pocketWebhook(@Body() payload: Record<string, any>) {
    const result = await this.pocketService.handleWebhook(payload);
    return { success: true, data: result };
  }
}
