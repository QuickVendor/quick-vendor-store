import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './providers/local.provider';
import { S3StorageProvider } from './providers/s3.provider';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly localProvider: LocalStorageProvider,
    private readonly s3Provider: S3StorageProvider,
  ) {
    const driver = this.configService.get<string>('storage.driver') ?? 'local';

    if (driver === 's3' && this.s3Provider.isConfigured()) {
      this.provider = this.s3Provider;
      this.logger.log('Using S3 storage provider');
    } else {
      this.provider = this.localProvider;
      if (driver === 's3') {
        this.logger.warn(
          'S3 requested but not configured — falling back to local',
        );
      } else {
        this.logger.log('Using local storage provider');
      }
    }
  }

  async uploadProductImage(
    fileBuffer: Buffer,
    originalFilename: string,
    productId: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const uniqueFilename = this.generateUniqueFilename(originalFilename);
    const key = `product-images/${productId}/${uniqueFilename}`;
    const url = await this.provider.upload(key, fileBuffer, contentType);
    return { url, key };
  }

  async uploadStoreBanner(
    fileBuffer: Buffer,
    originalFilename: string,
    userId: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const uniqueFilename = this.generateUniqueFilename(originalFilename);
    const key = `store-banners/${userId}/${uniqueFilename}`;
    const url = await this.provider.upload(key, fileBuffer, contentType);
    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.provider.delete(key);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${key}`, error);
    }
  }

  getUrl(key: string): string {
    return this.provider.getUrl(key);
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  getDriverName(): string {
    return this.configService.get<string>('storage.driver') ?? 'local';
  }

  private generateUniqueFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    return `${uuidv4()}${ext}`;
  }
}
