import { z } from 'zod';

export const emailSchema = z.email().max(320);
export const passwordSchema = z.string().min(12).max(128);
export const credentialsSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict();
export const emailOnlySchema = z.object({ email: emailSchema }).strict();
export const tokenSchema = z
  .object({ token: z.string().min(20).max(200) })
  .strict();
export const challengeSchema = z
  .object({ challenge: z.string().min(20).max(200) })
  .strict();
export const codeSchema = challengeSchema.extend({
  code: z.string().regex(/^\d{6}$/),
});
export const resetSchema = tokenSchema.extend({ password: passwordSchema });
