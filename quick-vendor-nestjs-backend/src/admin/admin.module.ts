import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';

import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminVendorsController } from './controllers/admin-vendors.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';

import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminVendorsService } from './services/admin-vendors.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminProductsService } from './services/admin-products.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminSettingsService } from './services/admin-settings.service';

@Module({
  imports: [PrismaModule, PaymentsModule, AuthModule],
  controllers: [
    AdminDashboardController,
    AdminVendorsController,
    AdminOrdersController,
    AdminReportsController,
    AdminProductsController,
    AdminAuditController,
    AdminSettingsController,
  ],
  providers: [
    AdminDashboardService,
    AdminVendorsService,
    AdminOrdersService,
    AdminReportsService,
    AdminProductsService,
    AdminAuditService,
    AdminSettingsService,
  ],
  exports: [AdminAuditService],
})
export class AdminModule {}
