import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
const url = process.env.DEMO_DATABASE_URL;
if (!url) throw new Error('DEMO_DATABASE_URL is required');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});
const owner = { primaryOwner: { email: { endsWith: '@phase6-demo.invalid' } } };
const result = {
  businesses: await db.business.count({
    where: { ...owner, status: 'APPROVED' },
  }),
  owners: await db.user.count({
    where: {
      email: { startsWith: 'owner', endsWith: '@phase6-demo.invalid' },
      role: 'BUSINESS_USER',
    },
  }),
  admins: await db.user.count({
    where: {
      email: { startsWith: 'admin', endsWith: '@phase6-demo.invalid' },
      role: 'ADMIN',
    },
  }),
  pilgrimage: await db.package.count({
    where: { status: 'PUBLISHED', profile: { business: owner } },
  }),
  tourism: await db.tourismPackage.count({
    where: { status: 'PUBLISHED', profile: { business: owner } },
  }),
  visa: await db.visaService.count({
    where: { status: 'PUBLISHED', profile: { business: owner } },
  }),
  ground: await db.service.count({
    where: { status: 'PUBLISHED', profile: { business: owner } },
  }),
};
if (Object.values(result).join() !== '10,10,2,50,50,50,50')
  throw new Error(`Demo verification failed: ${JSON.stringify(result)}`);
console.log(JSON.stringify(result, null, 2));
await db.$disconnect();
