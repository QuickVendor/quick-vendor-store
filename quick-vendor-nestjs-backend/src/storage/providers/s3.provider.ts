import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from '../storage.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client | null;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId =
      this.configService.get<string>('storage.s3.accessKeyId') ?? '';
    const secretAccessKey =
      this.configService.get<string>('storage.s3.secretAccessKey') ?? '';
    this.region = this.configService.get<string>('storage.s3.region') ?? '';
    this.bucketName =
      this.configService.get<string>('storage.s3.bucketName') ?? '';

    if (accessKeyId && secretAccessKey && this.region && this.bucketName) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(
        `S3 configured: bucket=${this.bucketName}, region=${this.region}`,
      );
    } else {
      this.s3Client = null;
      this.logger.warn(
        'S3 not configured — missing AWS credentials or bucket name',
      );
    }
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 is not configured');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );

    this.logger.log(`File uploaded to S3: ${key}`);
    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 is not configured');
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    this.logger.log(`File deleted from S3: ${key}`);
  }

  getUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  isConfigured(): boolean {
    return this.s3Client !== null;
  }

  async validateConnection(): Promise<boolean> {
    if (!this.s3Client) return false;

    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
      return true;
    } catch (error) {
      this.logger.error('S3 connection validation failed', error);
      return false;
    }
  }
}
