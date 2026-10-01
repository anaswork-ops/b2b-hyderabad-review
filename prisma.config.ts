import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'database/prisma/schema.prisma',
  migrations: { path: 'database/prisma/migrations' },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://LOCAL_USER:LOCAL_PASSWORD@127.0.0.1:55432/b2btravelv2_dev',
  },
});
