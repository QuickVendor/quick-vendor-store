import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { SetupPaymentDto } from './dto/setup-payment.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  email: string;
}

@ApiTags('Payments')
@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('banks')
  @ApiOperation({ summary: 'List Nigerian banks' })
  async getBanks() {
    return this.paymentsService.getBanks();
  }

  @Post('verify-account')
  @ApiOperation({ summary: 'Verify bank account name' })
  async verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.paymentsService.verifyAccount(dto);
  }

  @Post('setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set up vendor payment (bank details + Paystack subaccount)',
  })
  async setupPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetupPaymentDto,
  ) {
    await this.paymentsService.setupPayment(user.id, dto);
    return { message: 'Payment account set up successfully' };
  }

  @Post('webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook receiver' })
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody = (req as RawBodyRequest<Request>).rawBody;
    if (!rawBody) return;
    await this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Post('refund/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate refund for an order' })
  async initiateRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    await this.paymentsService.initiateRefund(orderId, user.id);
    return { message: 'Refund initiated successfully' };
  }
}
