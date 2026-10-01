import { z } from 'zod';
const short = z.string().trim().min(1).max(200);
const list = z.array(z.string().trim().min(1).max(200)).max(50);
const pricing = z
  .strictObject({
    pricingMode: z.enum(['FIXED', 'STARTING_FROM', 'ON_REQUEST']),
    price: z.number().positive().max(999999999999).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.pricingMode !== 'ON_REQUEST' && (!value.price || !value.currency))
      context.addIssue({
        code: 'custom',
        message: 'Displayed price requires amount and currency',
      });
    if (
      value.pricingMode === 'ON_REQUEST' &&
      (value.price !== undefined || value.currency !== undefined)
    )
      context.addIssue({
        code: 'custom',
        message: 'On-request pricing cannot display an amount',
      });
  });
export const profileSchema = z.strictObject({
  publicSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  name: short,
  businessType: z.enum(['TRAVEL_AGENCY', 'TOUR_OPERATOR', 'DMC']),
  description: z.string().trim().min(20).max(3000),
  headquartersCountry: short,
  headquartersState: short,
  headquartersCity: short,
  publicEmail: z.email().max(320).optional().or(z.literal('')),
  publicPhone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .optional()
    .or(z.literal('')),
  privateEmail: z.email().max(320),
  privatePhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  website: z.url().max(500).optional().or(z.literal('')),
  yearsOperating: z.number().int().min(0).max(200),
  languages: list.min(1),
  marketsServed: list.min(1),
  capabilities: list.min(1),
  serviceCountries: list.min(1),
  serviceCities: list.min(1),
  licenceNumber: short.optional().or(z.literal('')),
  licenceIssuer: short.optional().or(z.literal('')),
});
export const availabilitySchema = z
  .strictObject({
    kind: z.enum([
      'FIXED_DEPARTURE',
      'DATE_RANGE',
      'RECURRING',
      'YEAR_ROUND',
      'ON_REQUEST',
    ]),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    recurrence: z.string().trim().max(120).optional(),
    blackoutDates: z.array(z.iso.date()).max(100).default([]),
    capacity: z.number().int().positive().max(100000).optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === 'FIXED_DEPARTURE' && (!value.startDate || value.endDate))
      context.addIssue({
        code: 'custom',
        message: 'Fixed departure requires one date',
      });
    if (
      value.kind === 'DATE_RANGE' &&
      (!value.startDate || !value.endDate || value.endDate < value.startDate)
    )
      context.addIssue({ code: 'custom', message: 'Date range is invalid' });
    if (value.kind === 'RECURRING' && !value.recurrence)
      context.addIssue({ code: 'custom', message: 'Recurrence is required' });
  });
const packageBase = z.strictObject({
  name: short,
  subtype: z.enum(['HAJJ', 'UMRAH']),
  sourceMarket: short,
  departureCity: short,
  destinationCities: list.min(1),
  validFrom: z.iso.date().optional(),
  validTo: z.iso.date().optional(),
  totalNights: z.number().int().min(1).max(90),
  makkahNights: z.number().int().min(0).max(90),
  madinahNights: z.number().int().min(0).max(90),
  minimumGroupSize: z.number().int().positive().optional(),
  maximumGroupSize: z.number().int().positive().optional(),
  accommodation: z.record(z.string(), z.unknown()),
  roomOccupancy: list.min(1),
  transport: z.record(z.string(), z.unknown()),
  flights: z.record(z.string(), z.unknown()).optional(),
  meals: list,
  visaStatus: short,
  ziyarat: list,
  assistance: list,
  inclusions: list,
  exclusions: list,
  cancellationTerms: z.string().trim().min(10).max(3000),
  availability: z.array(availabilitySchema).min(1).max(30),
});
export const packageSchema = packageBase
  .and(pricing)
  .superRefine((value, context) => {
    if (value.totalNights !== value.makkahNights + value.madinahNights)
      context.addIssue({
        code: 'custom',
        message: 'Total nights must equal Makkah plus Madinah nights',
      });
    if (
      value.minimumGroupSize &&
      value.maximumGroupSize &&
      value.minimumGroupSize > value.maximumGroupSize
    )
      context.addIssue({
        code: 'custom',
        message: 'Group-size range is invalid',
      });
    if (value.validFrom && value.validTo && value.validTo < value.validFrom)
      context.addIssue({
        code: 'custom',
        message: 'Validity range is invalid',
      });
  });
export const serviceSchema = z
  .strictObject({
    name: short,
    subtype: z.enum(['HAJJ', 'UMRAH']),
    description: z.string().trim().min(10).max(3000),
    sourceMarket: short,
    serviceCountry: short,
    serviceCity: short,
    availability: z.array(availabilitySchema).min(1).max(30),
  })
  .and(pricing);
export const offerSchema = z
  .strictObject({
    packageId: z.guid().optional(),
    serviceId: z.guid().optional(),
    title: short,
    description: z.string().trim().min(10).max(2000),
    validFrom: z.iso.date(),
    validTo: z.iso.date(),
    active: z.boolean().default(true),
  })
  .and(pricing)
  .superRefine((value, context) => {
    if (Boolean(value.packageId) === Boolean(value.serviceId))
      context.addIssue({
        code: 'custom',
        message: 'Offer requires exactly one package or service',
      });
    if (value.validTo < value.validFrom)
      context.addIssue({
        code: 'custom',
        message: 'Offer validity is invalid',
      });
  });
export const lifecycleSchema = z.strictObject({
  action: z.enum(['PUBLISH', 'PAUSE', 'RESUME', 'ARCHIVE']),
});
export type ProfileInput = z.infer<typeof profileSchema>;
export type PackageInput = z.infer<typeof packageSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type OfferInput = z.infer<typeof offerSchema>;
