import { z } from 'zod';
const optionalText = z.string().trim().min(1).max(200).optional();
export const marketplaceQuerySchema = z
  .strictObject({
    mode: z.enum(['packages', 'services', 'businesses']).default('packages'),
    market: optionalText,
    subtype: z.enum(['HAJJ', 'UMRAH']).optional(),
    departure: optionalText,
    destination: optionalText,
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    groupSize: z.coerce.number().int().positive().max(100000).optional(),
    minNights: z.coerce.number().int().min(0).max(90).optional(),
    maxNights: z.coerce.number().int().min(0).max(90).optional(),
    makkahNights: z.coerce.number().int().min(0).max(90).optional(),
    madinahNights: z.coerce.number().int().min(0).max(90).optional(),
    occupancy: optionalText,
    visa: optionalText,
    transport: optionalText,
    meals: optionalText,
    pricingMode: z.enum(['FIXED', 'STARTING_FROM', 'ON_REQUEST']).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    supplierType: z.enum(['TRAVEL_AGENCY', 'TOUR_OPERATOR', 'DMC']).optional(),
    availability: z.enum(['AVAILABLE', 'ON_REQUEST']).optional(),
    page: z.coerce.number().int().positive().max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
  })
  .superRefine((v, c) => {
    if (
      v.startDate &&
      v.endDate &&
      Date.parse(v.endDate) - Date.parse(v.startDate) > 366 * 86400000
    )
      c.addIssue({
        code: 'custom',
        message: 'Date range must not exceed 366 days',
      });
    if (
      Boolean(v.startDate) !== Boolean(v.endDate) ||
      (v.startDate && v.endDate && v.endDate < v.startDate)
    )
      c.addIssue({ code: 'custom', message: 'Date range is invalid' });
    if (
      v.minNights !== undefined &&
      v.maxNights !== undefined &&
      v.minNights > v.maxNights
    )
      c.addIssue({ code: 'custom', message: 'Night range is invalid' });
    if (
      v.minPrice !== undefined &&
      v.maxPrice !== undefined &&
      v.minPrice > v.maxPrice
    )
      c.addIssue({ code: 'custom', message: 'Price range is invalid' });
  });
export const comparisonSchema = z.strictObject({
  packageIds: z.array(z.guid()).min(2).max(4),
});
export type MarketplaceQuery = z.infer<typeof marketplaceQuerySchema>;
