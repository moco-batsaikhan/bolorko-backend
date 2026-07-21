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
import { InvoiceDto } from './dto/invoice.dto';
import type { Request, Response, NextFunction } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('qpay/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a QPay invoice (authenticated)' })
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
  @UseGuards(JwtAuthGuard)
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
}
