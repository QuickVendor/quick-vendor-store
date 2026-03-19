import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeedbackService } from './feedback.service';

// ── Mock global fetch ──────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FeedbackService', () => {
  let service: FeedbackService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'slack.webhookUrl')
          return 'https://hooks.slack.com/test-webhook';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
  });

  // ── submitFeedback ─────────────────────────────────────
  describe('submitFeedback', () => {
    it('should return success message on valid submission', async () => {
      const result = await service.submitFeedback(
        { subject: 'Bug', message: 'Something broke' },
        '127.0.0.1',
      );

      expect(result).toEqual({ message: 'Feedback submitted successfully' });
    });

    it('should send feedback to Slack webhook when configured', async () => {
      await service.submitFeedback(
        {
          subject: 'Feature Request',
          message: 'Add dark mode',
          email: 'user@test.com',
          category: 'feature',
        },
        '127.0.0.1',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );

      const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentPayload.text).toContain('Feature Request');
      expect(sentPayload.text).toContain('Add dark mode');
      expect(sentPayload.text).toContain('user@test.com');
      expect(sentPayload.text).toContain('feature');
    });

    it('should not call fetch when Slack webhook is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      // Re-create service with no webhook
      const module = await Test.createTestingModule({
        providers: [
          FeedbackService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const noSlackService = module.get<FeedbackService>(FeedbackService);

      await noSlackService.submitFeedback(
        { subject: 'Test', message: 'No Slack' },
        '10.0.0.1',
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle Slack webhook failure gracefully (no throw)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(
        service.submitFeedback(
          { subject: 'Test', message: 'Slack down' },
          '127.0.0.1',
        ),
      ).resolves.toEqual({ message: 'Feedback submitted successfully' });
    });

    it('should handle network error to Slack gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.submitFeedback(
          { subject: 'Test', message: 'Network fail' },
          '127.0.0.1',
        ),
      ).resolves.toEqual({ message: 'Feedback submitted successfully' });
    });

    it('should include "N/A" for email when not provided', async () => {
      await service.submitFeedback(
        { subject: 'Anon', message: 'No email' },
        '127.0.0.1',
      );

      const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentPayload.text).toContain('N/A');
    });

    it('should include "General" for category when not provided', async () => {
      await service.submitFeedback(
        { subject: 'Test', message: 'No category' },
        '127.0.0.1',
      );

      const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentPayload.text).toContain('General');
    });
  });

  // ── Rate Limiting ──────────────────────────────────────
  describe('rate limiting', () => {
    it('should allow 5 requests within the window', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          service.submitFeedback(
            { subject: `Feedback ${i}`, message: 'Test' },
            '192.168.1.1',
          ),
        ).resolves.toEqual({ message: 'Feedback submitted successfully' });
      }
    });

    it('should throw 429 on the 6th request within the window', async () => {
      for (let i = 0; i < 5; i++) {
        await service.submitFeedback(
          { subject: `Feedback ${i}`, message: 'Test' },
          '192.168.1.100',
        );
      }

      await expect(
        service.submitFeedback(
          { subject: 'Feedback 6', message: 'Too many' },
          '192.168.1.100',
        ),
      ).rejects.toThrow(
        new HttpException(
          'Too many feedback submissions. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });

    it('should track different IPs independently', async () => {
      // Fill up IP-A
      for (let i = 0; i < 5; i++) {
        await service.submitFeedback(
          { subject: 'A', message: 'Test' },
          '10.0.0.1',
        );
      }

      // IP-B should still work
      await expect(
        service.submitFeedback(
          { subject: 'B', message: 'Different IP' },
          '10.0.0.2',
        ),
      ).resolves.toEqual({ message: 'Feedback submitted successfully' });
    });

    it('should reset the counter after the time window expires', async () => {
      // Use real Date manipulation since the service uses Date.now()
      const originalDateNow = Date.now;

      try {
        let currentTime = originalDateNow();
        Date.now = jest.fn(() => currentTime);

        // Fill rate limit
        for (let i = 0; i < 5; i++) {
          await service.submitFeedback(
            { subject: 'Fill', message: 'Test' },
            '172.16.0.1',
          );
        }

        // 6th should fail
        await expect(
          service.submitFeedback(
            { subject: 'Blocked', message: 'Test' },
            '172.16.0.1',
          ),
        ).rejects.toThrow(HttpException);

        // Advance past the 1-minute window
        currentTime += 61_000;

        // Should work again
        await expect(
          service.submitFeedback(
            { subject: 'Reset', message: 'After window' },
            '172.16.0.1',
          ),
        ).resolves.toEqual({ message: 'Feedback submitted successfully' });
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should handle "unknown" IP gracefully', async () => {
      await expect(
        service.submitFeedback(
          { subject: 'Test', message: 'Unknown IP' },
          'unknown',
        ),
      ).resolves.toEqual({ message: 'Feedback submitted successfully' });
    });
  });
});
