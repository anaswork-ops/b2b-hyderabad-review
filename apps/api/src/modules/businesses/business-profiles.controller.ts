import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { profileSchema } from '@b2b/validation/inventory';
import { AuthService } from '../auth/auth.service.js';
import { BusinessProfilesService } from './business-profiles.service.js';
const cookie = (req: Request) =>
  req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('b2b_session='))
    ?.slice(12);
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid request');
  return result.data;
};
const origin = (value?: string) => {
  if (value && value !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
    throw new BadRequestException('Invalid origin');
};
@Controller('businesses')
export class BusinessProfilesController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(BusinessProfilesService)
    private readonly profiles: BusinessProfilesService,
  ) {}
  @Get('mine/profile') async mine(@Req() req: Request) {
    return this.profiles.mine(await this.auth.requireSession(cookie(req)));
  }
  @Put('mine/profile') async save(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    origin(requestOrigin);
    return this.profiles.save(
      await this.auth.requireSession(cookie(req), csrf ?? ''),
      parse(profileSchema, body),
    );
  }
  @Get('public/:slug') public(@Param('slug') slug: string) {
    return this.profiles.public(
      parse(
        z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(120),
        slug,
      ),
    );
  }
  @Get('network/:slug') async network(
    @Req() req: Request,
    @Param('slug') slug: string,
  ) {
    const user = await this.auth.requireSession(cookie(req));
    await this.auth.assertApprovedBusinessUser(user);
    return this.profiles.public(
      parse(
        z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(120),
        slug,
      ),
      true,
    );
  }
}
