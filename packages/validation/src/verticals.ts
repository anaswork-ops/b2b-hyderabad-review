import { z } from 'zod';
import { availabilitySchema } from './inventory.js';
const short = z.string().trim().min(1).max(200),
  list = z.array(short).max(50);
const commercial = z
  .strictObject({
    pricingMode: z.enum(['FIXED', 'STARTING_FROM', 'ON_REQUEST']),
    price: z.number().positive().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    availability: z.array(availabilitySchema).min(1).max(30),
  })
  .superRefine((v, c) => {
    if (
      v.pricingMode === 'ON_REQUEST'
        ? v.price !== undefined || v.currency !== undefined
        : !v.price || !v.currency
    )
      c.addIssue({ code: 'custom', message: 'Invalid pricing' });
  });
export const tourismSchema = z
  .strictObject({
    name: short,
    description: z.string().trim().min(20).max(3000),
    sourceMarket: short,
    departureCity: short,
    destinationCountry: short,
    destinationCities: list.min(1),
    category: short,
    durationDays: z.number().int().positive().max(365),
    minimumGroupSize: z.number().int().positive().optional(),
    maximumGroupSize: z.number().int().positive().optional(),
    accommodation: z.string().trim().min(1).max(1000),
    transport: z.string().trim().min(1).max(1000),
    inclusions: list,
    exclusions: list,
  })
  .and(commercial);
export const visaSchema = z
  .strictObject({
    name: short,
    description: z.string().trim().min(20).max(3000),
    sourceMarket: short,
    applicantNationality: short,
    destinationCountry: short,
    visaCategory: short,
    processingRequirement: z.string().trim().min(10).max(1000),
    documentSummary: z.string().trim().min(10).max(2000),
    appointmentAssistance: z.boolean(),
    governmentFeeIncluded: z.boolean(),
  })
  .and(commercial);
export const verticalSearchSchema = z
  .strictObject({
    vertical: z.enum(['tourism', 'visa']),
    market: short.optional(),
    destination: short.optional(),
    category: short.optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    groupSize: z.coerce.number().int().positive().optional(),
    pricingMode: z.enum(['FIXED', 'STARTING_FROM', 'ON_REQUEST']).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    maxPrice: z.coerce.number().positive().optional(),
    page: z.coerce.number().int().positive().max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
  })
  .superRefine((v, c) => {
    if (
      Boolean(v.startDate) !== Boolean(v.endDate) ||
      (v.startDate && v.endDate && v.endDate < v.startDate)
    )
      c.addIssue({ code: 'custom', message: 'Invalid dates' });
  });
export type TourismInput = z.infer<typeof tourismSchema>;
export type VisaInput = z.infer<typeof visaSchema>;
export type VerticalSearch = z.infer<typeof verticalSearchSchema>;
