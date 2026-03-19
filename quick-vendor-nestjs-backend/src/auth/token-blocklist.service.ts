import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * JWT blocklist backed by Redis (production) or in-memory Map (development).
 *
 * When REDIS_URL is configured, blocked tokens are stored in Redis with
 * automatic TTL expiry matching the JWT lifetime. This supports
 * multi-instance deployments where the in-memory approach would fail.
 *
 * Falls back to an in-memory Map when Redis is not available.
 */
@Injectable()
export class TokenBlocklistService implements OnModuleInit {
  private readonly logger = new Logger(TokenBlocklistService.name);
  private readonly ttlSeconds: number;
  private redis: Redis | null = null;

  // In-memory fallback
  private readonly memoryBlocklist = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {
    const minutes =
      this.configService.get<number>('jwt.expirationMinutes') ?? 30;
    this.ttlSeconds = minutes * 60;
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — using in-memory token blocklist (not suitable for multi-instance)',
      );
      this.cleanupInterval = setInterval(
        () => this.cleanupMemory(),
        5 * 60 * 1000,
      );
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      await this.redis.connect();
      this.logger.log('Redis token blocklist connected');
    } catch (error) {
      this.logger.warn(
        'Redis connection failed — falling back to in-memory blocklist',
        error,
      );
      this.redis = null;
      this.cleanupInterval = setInterval(
        () => this.cleanupMemory(),
        5 * 60 * 1000,
      );
    }
  }

  async block(token: string): Promise<void> {
    const key = `blocklist:${this.hash(token)}`;

    if (this.redis) {
      await this.redis.setex(key, this.ttlSeconds, '1');
    } else {
      this.memoryBlocklist.set(token, Date.now() + this.ttlSeconds * 1000);
    }

    this.logger.debug('Token blocked');
  }

  async isBlocked(token: string): Promise<boolean> {
    if (this.redis) {
      const key = `blocklist:${this.hash(token)}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    }

    const expiresAt = this.memoryBlocklist.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.memoryBlocklist.delete(token);
      return false;
    }
    return true;
  }

  /**
   * Hash the token to avoid storing full JWTs in Redis keys.
   * Uses a simple FNV-1a hash — collision resistance isn't critical here.
   */
  private hash(token: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  private cleanupMemory(): void {
    const now = Date.now();
    let removed = 0;
    for (const [token, expiresAt] of this.memoryBlocklist) {
      if (now > expiresAt) {
        this.memoryBlocklist.delete(token);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(
        `Blocklist cleanup: removed ${removed} expired entries`,
      );
    }
  }
}
