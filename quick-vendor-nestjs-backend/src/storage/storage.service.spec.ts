/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local.provider';
import { S3StorageProvider } from './providers/s3.provider';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildConfigGet(driver: 'local' | 's3', appEnv = 'local') {
  return jest.fn().mockImplementation((key: string) => {
    if (key === 'storage.driver') return driver;
    if (key === 'appEnv') return appEnv;
    return undefined;
  });
}

function buildLocalProvider(): jest.Mocked<LocalStorageProvider> {
  return {
    upload: jest.fn().mockResolvedValue('/uploads/product-images/p1/file.jpg'),
    delete: jest.fn().mockResolvedValue(undefined),
    getUrl: jest.fn().mockReturnValue('/uploads/product-images/p1/file.jpg'),
    isConfigured: jest.fn().mockReturnValue(true),
  } as any;
}

function buildS3Provider(configured = true): jest.Mocked<S3StorageProvider> {
  return {
    upload: jest
      .fn()
      .mockResolvedValue(
        'https://bucket.s3.region.amazonaws.com/product-images/p1/file.jpg',
      ),
    delete: jest.fn().mockResolvedValue(undefined),
    getUrl: jest
      .fn()
      .mockReturnValue(
        'https://bucket.s3.region.amazonaws.com/product-images/p1/file.jpg',
      ),
    isConfigured: jest.fn().mockReturnValue(configured),
  } as any;
}

async function build(
  driver: 'local' | 's3',
  appEnv: string,
  s3Configured = true,
): Promise<{
  service: StorageService;
  local: jest.Mocked<LocalStorageProvider>;
  s3: jest.Mocked<S3StorageProvider>;
}> {
  const local = buildLocalProvider();
  const s3 = buildS3Provider(s3Configured);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StorageService,
      {
        provide: ConfigService,
        useValue: { get: buildConfigGet(driver, appEnv) },
      },
      { provide: LocalStorageProvider, useValue: local },
      { provide: S3StorageProvider, useValue: s3 },
    ],
  }).compile();

  return { service: module.get<StorageService>(StorageService), local, s3 };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('StorageService', () => {
  // ── Provider selection ──────────────────────────────────────────────────────
  describe('provider selection', () => {
    it('uses LocalStorageProvider when driver=local', async () => {
      const { service, local, s3 } = await build('local', 'local');
      const file = Buffer.from('data');

      await service.uploadProductImage(file, 'test.jpg', 'p1', 'image/jpeg');

      expect(local.upload).toHaveBeenCalled();
      expect(s3.upload).not.toHaveBeenCalled();
    });

    it('uses S3StorageProvider when driver=s3 and S3 is configured', async () => {
      const { service, local, s3 } = await build('s3', 'staging');
      const file = Buffer.from('data');

      await service.uploadProductImage(file, 'test.jpg', 'p1', 'image/jpeg');

      expect(s3.upload).toHaveBeenCalled();
      expect(local.upload).not.toHaveBeenCalled();
    });

    it('falls back to local in dev when S3 is requested but unconfigured', async () => {
      const { service, local } = await build('s3', 'local', false);
      const file = Buffer.from('data');

      await service.uploadProductImage(file, 'test.jpg', 'p1', 'image/jpeg');

      expect(local.upload).toHaveBeenCalled();
    });

    it('throws when S3 is unconfigured in non-local environment', async () => {
      await expect(build('s3', 'staging', false)).rejects.toThrow(
        /refusing to fall back to local storage/,
      );
    });

    it('throws when S3 is unconfigured in production', async () => {
      await expect(build('s3', 'production', false)).rejects.toThrow(
        /refusing to fall back to local storage/,
      );
    });
  });

  // ── uploadProductImage ──────────────────────────────────────────────────────
  describe('uploadProductImage', () => {
    it('builds the correct S3 key: product-images/{productId}/{uuid}.ext', async () => {
      const { service, s3 } = await build('s3', 'staging');

      await service.uploadProductImage(
        Buffer.from('img'),
        'photo.png',
        'prod-99',
        'image/png',
      );

      const calledKey: string = s3.upload.mock.calls[0][0];
      expect(calledKey).toMatch(/^product-images\/prod-99\/.+\.png$/);
    });

    it('preserves the original file extension', async () => {
      const { service, s3 } = await build('s3', 'staging');

      await service.uploadProductImage(
        Buffer.from('img'),
        'photo.JPEG',
        'prod-1',
        'image/jpeg',
      );

      const calledKey: string = s3.upload.mock.calls[0][0];
      expect(calledKey.endsWith('.JPEG')).toBe(true);
    });

    it('passes the correct buffer and content-type to the provider', async () => {
      const { service, local } = await build('local', 'local');
      const buf = Buffer.from('pixel-data');

      await service.uploadProductImage(buf, 'img.jpg', 'p1', 'image/jpeg');

      expect(local.upload).toHaveBeenCalledWith(
        expect.any(String),
        buf,
        'image/jpeg',
      );
    });

    it('returns the provider URL', async () => {
      const { service } = await build('local', 'local');

      const result = await service.uploadProductImage(
        Buffer.from('x'),
        'img.jpg',
        'p1',
        'image/jpeg',
      );

      expect(result.url).toBe('/uploads/product-images/p1/file.jpg');
    });
  });

  // ── uploadStoreBanner ───────────────────────────────────────────────────────
  describe('uploadStoreBanner', () => {
    it('builds the correct key: store-banners/{userId}/{uuid}.ext', async () => {
      const { service, s3 } = await build('s3', 'staging');

      await service.uploadStoreBanner(
        Buffer.from('img'),
        'banner.webp',
        'user-42',
        'image/webp',
      );

      const calledKey: string = s3.upload.mock.calls[0][0];
      expect(calledKey).toMatch(/^store-banners\/user-42\/.+\.webp$/);
    });
  });

  // ── deleteFile ──────────────────────────────────────────────────────────────
  describe('deleteFile', () => {
    it('delegates to the active provider', async () => {
      const { service, local } = await build('local', 'local');

      await service.deleteFile('product-images/p1/file.jpg');

      expect(local.delete).toHaveBeenCalledWith('product-images/p1/file.jpg');
    });

    it('swallows provider errors and does not rethrow', async () => {
      const { service, local } = await build('local', 'local');
      local.delete.mockRejectedValue(new Error('disk full'));

      await expect(
        service.deleteFile('product-images/p1/file.jpg'),
      ).resolves.not.toThrow();
    });
  });

  // ── getDriverName ───────────────────────────────────────────────────────────
  describe('getDriverName', () => {
    it('returns "local" for local driver', async () => {
      const { service } = await build('local', 'local');
      expect(service.getDriverName()).toBe('local');
    });

    it('returns "s3" for S3 driver', async () => {
      const { service } = await build('s3', 'staging');
      expect(service.getDriverName()).toBe('s3');
    });
  });

  // ── isConfigured ────────────────────────────────────────────────────────────
  describe('isConfigured', () => {
    it('returns true for local driver', async () => {
      const { service } = await build('local', 'local');
      expect(service.isConfigured()).toBe(true);
    });

    it('returns true when S3 driver is properly configured', async () => {
      const { service } = await build('s3', 'staging');
      expect(service.isConfigured()).toBe(true);
    });
  });
});
