import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider } from '../storage.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async upload(
    key: string,
    body: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _contentType: string,
  ): Promise<string> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, body);
    this.logger.log(`File saved locally: ${key}`);

    return this.getUrl(key);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted locally: ${key}`);
    }
  }

  /**
   * Return a relative path — clients prepend their own base URL.
   * This makes stored URLs portable across dev/staging/production.
   */
  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  isConfigured(): boolean {
    return true; // Local storage is always available
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadDir}`);
    }
  }
}
