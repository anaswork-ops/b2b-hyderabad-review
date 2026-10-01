import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
let client: PrismaClient | undefined;
export function getDatabase(): PrismaClient {
  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
  client ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    }),
  });
  return client;
}
export async function probeDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
