import { z } from 'zod';
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  services: z.record(z.string(), z.enum(['up', 'down'])),
});
