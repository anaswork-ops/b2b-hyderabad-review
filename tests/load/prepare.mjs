import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(root + '/apps/api/package.json');
const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (
  !/^\/b2b_restore_[a-z0-9_]+$/.test(url.pathname) ||
  process.env.ALLOW_ISOLATED_LOAD !== '1'
)
  throw new Error(
    'A controlled b2b_restore_ database and explicit load authorization are required',
  );
const directory = root + '/.local/load';
mkdirSync(directory, { recursive: true });
const output = directory + '/fixtures.json';
if (existsSync(output))
  throw new Error(
    'Existing fixture file retained; use its sessions or archive it deliberately before preparing a new run',
  );
const { PrismaClient } = require('@prisma/client'),
  { PrismaPg } = require('@prisma/adapter-pg');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString() }),
});
const profile = await db.businessProfile.findFirstOrThrow({
  where: { business: { status: 'APPROVED' } },
});
const packageIds = (
  await db.package.findMany({
    where: { status: 'PUBLISHED', moderationHidden: false },
    take: 2,
  })
).map((x) => x.id);
if (packageIds.length !== 2) throw new Error('Two published packages required');
const fixtures = [];
const hash = (x) => createHash('sha256').update(x).digest('hex');
for (let i = 0; i < 500; i++) {
  const token = randomUUID(),
    csrf = randomUUID();
  const user = await db.user.create({
    data: {
      email: `load-${randomUUID()}@example.test`,
      passwordHash: 'non-login isolated fixture',
      emailVerifiedAt: new Date(),
    },
  });
  const business = await db.business.create({
    data: { primaryOwnerId: user.id, status: 'APPROVED' },
  });
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hash(token),
      csrfHash: hash(csrf),
      expiresAt: new Date(Date.now() + 8 * 3600000),
    },
  });
  const conversation = await db.conversation.create({
    data: {
      contextType: 'BUSINESS',
      contextBusinessId: profile.businessId,
      participants: {
        create: [
          { businessId: business.id },
          { businessId: profile.businessId },
        ],
      },
    },
  });
  fixtures.push({
    token,
    csrf,
    slug: profile.publicSlug,
    packageIds,
    conversationId: conversation.id,
  });
}
writeFileSync(output, JSON.stringify(fixtures), { flag: 'wx', mode: 0o600 });
await db.$disconnect();
console.log(
  'Created 500 isolated synthetic identities and sessions; private fixture file saved.',
);
