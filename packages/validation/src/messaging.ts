import { z } from 'zod';
const text = z.string().trim().min(1).max(4000);
export const startConversationSchema = z.strictObject({
  contextType: z.enum([
    'BUSINESS',
    'PACKAGE',
    'SERVICE',
    'OFFER',
    'TOURISM_PACKAGE',
    'VISA_SERVICE',
  ]),
  contextId: z.string().trim().min(1).max(120),
  message: text,
});
export const sendMessageSchema = z.strictObject({ body: text });
export const customRequestSchema = z
  .strictObject({
    providerSlug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    subtype: z.enum(['HAJJ', 'UMRAH']),
    departureCity: z.string().trim().min(1).max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    groupSize: z.number().int().positive().max(100000),
    totalNights: z.number().int().positive().max(90),
    makkahNights: z.number().int().min(0).max(90),
    madinahNights: z.number().int().min(0).max(90),
    requirements: text,
  })
  .superRefine((v, c) => {
    if (v.endDate < v.startDate)
      c.addIssue({ code: 'custom', message: 'Date range is invalid' });
    if (v.totalNights !== v.makkahNights + v.madinahNights)
      c.addIssue({ code: 'custom', message: 'Night totals are invalid' });
  });
export const reportSchema = z.strictObject({
  reason: z.string().trim().min(10).max(1000),
});
export const conversationSearchSchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type CustomRequestInput = z.infer<typeof customRequestSchema>;
