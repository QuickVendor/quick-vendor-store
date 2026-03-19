import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Seed platform settings (singleton)
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      commissionPercentage: 5,
      orderExpirationMinutes: 30,
      escalationThreshold: 3,
      escalationWindowDays: 30,
    },
  });
  console.log('Platform settings seeded');

  // Seed SUPER_ADMIN user
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@quickvendor.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123456';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        hashedPassword,
        whatsappNumber: '0000000000',
        role: UserRole.SUPER_ADMIN,
        storeName: 'QuickVendor Admin',
      },
    });
    console.log(`Super admin created: ${adminEmail}`);
  } else {
    console.log(`Super admin already exists: ${adminEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
