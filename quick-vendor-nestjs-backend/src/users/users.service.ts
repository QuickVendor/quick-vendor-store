import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserCacheService } from '../auth/user-cache.service';
import { StorageService } from '../storage/storage.service';
import { User } from '@prisma/client';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly userCache: UserCacheService,
    private readonly storageService: StorageService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        hashedPassword,
        whatsappNumber: dto.whatsapp_number ?? '',
        storeName: dto.store_name ?? null,
      },
    });

    this.logger.log(`User registered: ${user.email}`);

    // Async WhatsApp validation (non-blocking)
    if (user.whatsappNumber) {
      void this.whatsAppService.validateAndUpdate(user.id, user.whatsappNumber);
    }

    return user;
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateStore(userId: string, dto: UpdateStoreDto): Promise<User> {
    // Check slug uniqueness if updating
    if (dto.store_slug) {
      const existing = await this.prisma.user.findUnique({
        where: { storeSlug: dto.store_slug },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Store slug already taken');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.store_name !== undefined && { storeName: dto.store_name }),
        ...(dto.store_slug !== undefined && { storeSlug: dto.store_slug }),
        ...(dto.whatsapp_number !== undefined && {
          whatsappNumber: dto.whatsapp_number,
          whatsappVerified: false, // Reset verification on number change
        }),
      },
    });

    this.userCache.invalidate(userId);

    // Re-validate if WhatsApp number changed (non-blocking)
    if (dto.whatsapp_number) {
      void this.whatsAppService.validateAndUpdate(userId, dto.whatsapp_number);
    }

    return updated;
  }

  async uploadBanner(userId: string, file: Express.Multer.File): Promise<User> {
    // Delete existing banner if present
    const user = await this.getProfile(userId);
    if (user.bannerUrl) {
      await this.deleteExistingBanner(user.bannerUrl);
    }

    const result = await this.storageService.uploadStoreBanner(
      file.buffer,
      file.originalname,
      userId,
      file.mimetype,
    );

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrl: result.url },
    });
    this.userCache.invalidate(userId);
    return updated;
  }

  async deleteBanner(userId: string): Promise<User> {
    const user = await this.getProfile(userId);

    if (user.bannerUrl) {
      await this.deleteExistingBanner(user.bannerUrl);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrl: null },
    });
    this.userCache.invalidate(userId);
    return updated;
  }

  private async deleteExistingBanner(bannerUrl: string): Promise<void> {
    try {
      // Extract key from URL — works for both local and S3
      const key = this.extractKeyFromUrl(bannerUrl);
      if (key) {
        await this.storageService.deleteFile(key);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete banner: ${bannerUrl}`, error);
    }
  }

  private extractKeyFromUrl(url: string): string | null {
    // For S3 URLs: https://bucket.s3.region.amazonaws.com/key
    // For local URLs: http://localhost:3000/uploads/key
    const s3Match = url.match(/amazonaws\.com\/(.+)$/);
    if (s3Match) return s3Match[1];

    const localMatch = url.match(/\/uploads\/(.+)$/);
    if (localMatch) return localMatch[1];

    return null;
  }
}
