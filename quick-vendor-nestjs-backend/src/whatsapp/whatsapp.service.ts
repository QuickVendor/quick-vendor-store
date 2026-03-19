import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface AbstractApiResponse {
  phone: string;
  valid: boolean;
  format: {
    international: string;
    local: string;
  };
  country: {
    code: string;
    name: string;
  };
  type: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>('whatsapp.abstractApiKey') ?? '';
    this.enabled = !!this.apiKey;
  }

  /**
   * Validate a WhatsApp number via Abstract API.
   * Non-blocking — if validation fails or is disabled, we log and move on.
   * Returns true if valid, false if invalid, null if validation was skipped.
   */
  async validate(phone: string): Promise<boolean | null> {
    if (!this.enabled) {
      this.logger.debug(
        'WhatsApp validation skipped — ABSTRACT_API_KEY not configured',
      );
      return null;
    }

    try {
      const normalized = phone.replace(/\s+/g, '').replace(/^0/, '+234');
      const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${this.apiKey}&phone=${encodeURIComponent(normalized)}`;

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          `Abstract API returned ${response.status} for ${normalized}`,
        );
        return null;
      }

      const data = (await response.json()) as AbstractApiResponse;
      return data.valid;
    } catch (error) {
      this.logger.warn('WhatsApp validation request failed', error);
      return null;
    }
  }

  /**
   * Validate and update the user's whatsappVerified field.
   * Fire-and-forget — call without awaiting in registration/update flows.
   */
  async validateAndUpdate(userId: string, phone: string): Promise<void> {
    const result = await this.validate(phone);
    if (result === null) return; // Validation skipped or errored

    await this.prisma.user.update({
      where: { id: userId },
      data: { whatsappVerified: result },
    });

    this.logger.log(
      `WhatsApp ${result ? 'verified' : 'invalid'} for user ${userId}`,
    );
  }
}
