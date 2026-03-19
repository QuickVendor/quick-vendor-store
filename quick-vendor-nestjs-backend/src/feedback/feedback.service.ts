import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeedbackDto } from './dto/feedback.dto';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly MAX_REQUESTS = 5;
  private readonly WINDOW_MS = 60_000; // 1 minute

  constructor(private readonly configService: ConfigService) {}

  async submitFeedback(
    dto: FeedbackDto,
    clientIp: string,
  ): Promise<{ message: string }> {
    // Rate limiting
    this.checkRateLimit(clientIp);

    // Send to Slack
    const webhookUrl = this.configService.get<string>('slack.webhookUrl');
    if (webhookUrl) {
      await this.sendToSlack(webhookUrl, dto);
    } else {
      this.logger.warn('Slack webhook not configured — feedback logged only');
    }

    this.logger.log(
      `Feedback received: ${dto.subject} from ${dto.email ?? 'anonymous'}`,
    );

    return { message: 'Feedback submitted successfully' };
  }

  private checkRateLimit(clientIp: string): void {
    const now = Date.now();
    const entry = this.rateLimitMap.get(clientIp);

    if (!entry || now > entry.resetTime) {
      this.rateLimitMap.set(clientIp, {
        count: 1,
        resetTime: now + this.WINDOW_MS,
      });
      return;
    }

    if (entry.count >= this.MAX_REQUESTS) {
      throw new HttpException(
        'Too many feedback submissions. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
  }

  private async sendToSlack(
    webhookUrl: string,
    dto: FeedbackDto,
  ): Promise<void> {
    try {
      const payload = {
        text: `📬 *New Feedback*\n*Subject:* ${dto.subject}\n*Category:* ${dto.category ?? 'General'}\n*Email:* ${dto.email ?? 'N/A'}\n*Message:* ${dto.message}`,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(`Slack webhook failed: ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to send feedback to Slack', error);
    }
  }
}
