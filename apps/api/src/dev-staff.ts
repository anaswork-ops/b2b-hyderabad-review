import argon2 from 'argon2';
import { getDatabase } from './platform/db/prisma.js';

if (process.env.NODE_ENV !== 'development') throw new Error('Development only');
const [email, role] = process.argv.slice(2);
if (
  !email ||
  !/^[^@\s]+@example\.test$/.test(email) ||
  !['ADMIN', 'SUPER_ADMIN'].includes(role)
)
  throw new Error(
    'Usage: dev:staff <synthetic-name@example.test> ADMIN|SUPER_ADMIN',
  );
if (!process.stdin.isTTY || !process.stdin.setRawMode)
  throw new Error('Interactive terminal required');
process.stdout.write('Synthetic staff password (12+ characters): ');
let password = '';
process.stdin.setRawMode(true);
process.stdin.resume();
try {
  for await (const chunk of process.stdin) {
    for (const byte of chunk as Buffer) {
      if (byte === 3) process.exit(130);
      if (byte === 13) {
        process.stdout.write('\n');
        process.stdin.pause();
        break;
      }
      if (byte === 8 || byte === 127) password = password.slice(0, -1);
      else if (byte >= 32 && byte <= 126) password += String.fromCharCode(byte);
    }
    if (!process.stdin.isPaused()) continue;
    break;
  }
} finally {
  process.stdin.setRawMode(false);
}
if (password.length < 12 || password.length > 128)
  throw new Error('Password length must be 12–128 characters');
const db = getDatabase();
try {
  await db.user.create({
    data: {
      email: email.toLowerCase(),
      role: role as 'ADMIN' | 'SUPER_ADMIN',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      emailVerifiedAt: new Date(),
    },
  });
  process.stdout.write(
    'Synthetic staff account created for local MFA testing.\n',
  );
} finally {
  password = '';
  await db.$disconnect();
}
