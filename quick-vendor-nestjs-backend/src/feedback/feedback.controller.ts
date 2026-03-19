import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { FeedbackService } from './feedback.service';
import { FeedbackDto } from './dto/feedback.dto';

@ApiTags('feedback')
@Controller('api/feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly configService: ConfigService,
  ) {}

  @Post('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit feedback (rate-limited)' })
  async submitFeedback(
    @Body() feedbackDto: FeedbackDto,
    @Req() req: Request,
    @Headers('x-feedback-secret') secret?: string,
  ): Promise<{ message: string }> {
    // Optional secret key auth
    const expectedSecret = this.configService.get<string>(
      'slack.feedbackSecretKey',
    );
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid feedback secret key');
    }

    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.feedbackService.submitFeedback(feedbackDto, clientIp);
  }

  @Get('health')
  @ApiOperation({ summary: 'Feedback service health check' })
  getHealth(): { status: string; slack_configured: boolean } {
    const webhookUrl = this.configService.get<string>('slack.webhookUrl');
    return {
      status: 'ok',
      slack_configured: !!webhookUrl,
    };
  }
}
