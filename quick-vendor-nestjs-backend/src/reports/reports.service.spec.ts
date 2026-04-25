/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_REPORT = {
  id: 'report-1',
  vendorId: 'vendor-1',
  category: 'FRAUD',
  description: 'Vendor did not deliver',
  customerEmail: 'customer@test.com',
  customerPhone: null,
  orderId: null,
  status: 'OPEN',
  createdAt: new Date('2026-01-01'),
};

const BASE_DTO = {
  vendorId: 'vendor-1',
  category: 'FRAUD' as const,
  description: 'Vendor did not deliver',
  customerEmail: 'customer@test.com',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    order: { findUnique: jest.Mock };
    report: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      order: { findUnique: jest.fn() },
      report: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ── create ───────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create and return a report when vendor exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'vendor-1',
        email: 'v@v.com',
      });
      prisma.report.create.mockResolvedValue(MOCK_REPORT);

      const result = await service.create(BASE_DTO);

      expect(result).toEqual(MOCK_REPORT);
      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vendorId: 'vendor-1',
            category: 'FRAUD',
            customerEmail: 'customer@test.com',
          }),
        }),
      );
    });

    it('should throw NotFoundException when vendor does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create(BASE_DTO)).rejects.toThrow(NotFoundException);
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it('should accept an optional orderId and verify the order exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'vendor-1' });
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1' });
      prisma.report.create.mockResolvedValue({
        ...MOCK_REPORT,
        orderId: 'order-1',
      });

      const result = await service.create({ ...BASE_DTO, orderId: 'order-1' });

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
      });
      expect(result.orderId).toBe('order-1');
    });

    it('should throw NotFoundException when provided orderId does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'vendor-1' });
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...BASE_DTO, orderId: 'ghost-order' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it('should not check for an order when orderId is omitted', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'vendor-1' });
      prisma.report.create.mockResolvedValue(MOCK_REPORT);

      await service.create(BASE_DTO); // no orderId

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('should persist customerPhone when provided', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'vendor-1' });
      prisma.report.create.mockResolvedValue({
        ...MOCK_REPORT,
        customerPhone: '+2348012345678',
      });

      await service.create({ ...BASE_DTO, customerPhone: '+2348012345678' });

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerPhone: '+2348012345678' }),
        }),
      );
    });

    it('should support all report category values', async () => {
      const categories = [
        'FRAUD',
        'COUNTERFEIT_GOODS',
        'NON_DELIVERY',
        'POOR_QUALITY',
        'HARASSMENT',
        'WRONG_ITEM',
        'OTHER',
      ] as const;

      for (const category of categories) {
        prisma.user.findUnique.mockResolvedValue({ id: 'vendor-1' });
        prisma.report.create.mockResolvedValue({ ...MOCK_REPORT, category });

        const result = await service.create({ ...BASE_DTO, category });
        expect(result.category).toBe(category);
      }
    });
  });
});
