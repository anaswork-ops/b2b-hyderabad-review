import { z } from 'zod';
export const adminQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).default(''),
  businessId: z.guid().optional(),
  resourceId: z.guid().optional(),
  actorId: z.guid().optional(),
  action: z.string().max(80).optional(),
});
export const listingKindSchema = z.enum([
  'packages',
  'services',
  'offers',
  'tourism',
  'visa',
]);
export const moderationSchema = z.strictObject({
  hidden: z.boolean(),
  reason: z.string().trim().min(10).max(2000),
});
export const businessStatusSchema = z.strictObject({
  action: z.enum(['SUSPEND', 'REACTIVATE']),
  reason: z.string().trim().min(10).max(2000),
});
export const reportResolutionSchema = z.strictObject({
  reason: z.string().trim().min(10).max(2000),
});
export type AdminQuery = z.infer<typeof adminQuerySchema>;
export type ListingKind = z.infer<typeof listingKindSchema>;
