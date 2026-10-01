import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
const list = z.array(z.string().trim().min(2).max(100)).max(30);
export const applicationDraftSchema = z.strictObject({
  legalName: text(200).optional(),
  tradingName: text(200).optional(),
  businessType: z.enum(['TRAVEL_AGENCY', 'TOUR_OPERATOR', 'DMC']).optional(),
  address: text(500).optional(),
  country: text(100).optional(),
  state: text(100).optional(),
  city: text(100).optional(),
  contactEmail: z.email().max(320).optional(),
  contactMobile: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .optional(),
  website: z.url().max(500).optional().or(z.literal('')),
  yearsOperating: z.number().int().min(0).max(200).optional(),
  capabilities: list.optional(),
  sourceMarkets: list.optional(),
  saudiDestinations: list.optional(),
  licenceNumber: text(120).optional(),
  licenceIssuer: text(200).optional(),
});
export const reviewSchema = z.strictObject({
  action: z.enum([
    'START_REVIEW',
    'REQUEST_INFORMATION',
    'APPROVE',
    'REJECT',
    'SUSPEND',
    'REACTIVATE',
  ]),
  note: z.string().trim().max(2000).optional(),
});
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;
export type ReviewAction = z.infer<typeof reviewSchema>;
export const documentRequirementSchema = z.strictObject({
  market: z.string().trim().min(1).max(100),
  businessType: z.enum(['TRAVEL_AGENCY', 'TOUR_OPERATOR', 'DMC']),
  kind: z.enum(['REGISTRATION_LICENCE', 'SUPPORTING']),
  required: z.boolean(),
  enabled: z.boolean(),
});
export type DocumentRequirementInput = z.infer<
  typeof documentRequirementSchema
>;
