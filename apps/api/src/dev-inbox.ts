import { getDatabase } from './platform/db/prisma.js';
import { decrypt } from './modules/auth/crypto.js';

if (process.env.NODE_ENV !== 'development') throw new Error('Development only');
const [email, kind] = process.argv.slice(2);
const intentKind =
  kind === 'reset'
    ? 'PASSWORD_RESET'
    : kind === 'mobile'
      ? 'MOBILE_VERIFICATION'
      : kind === 'verify'
        ? 'EMAIL_VERIFICATION'
        : null;
if (!email || !intentKind)
  throw new Error('Usage: dev:inbox <email> verify|reset|mobile');
const db = getDatabase();
try {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  const intent =
    user &&
    (await db.notificationIntent.findFirst({
      where: { recipientUserId: user.id, kind: intentKind },
      orderBy: { createdAt: 'desc' },
    }));
  if (!intent) throw new Error('No matching local intent');
  const route = kind === 'reset' ? 'reset-password' : 'verify-email';
  if (kind === 'mobile') {
    process.stdout.write(decrypt(intent.payloadEncrypted) + '\n');
  } else
    process.stdout.write(
      `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/${route}#token=${encodeURIComponent(decrypt(intent.payloadEncrypted))}\n`,
    );
} finally {
  await db.$disconnect();
}
