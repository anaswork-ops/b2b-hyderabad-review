import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  comparisonSchema,
  marketplaceQuerySchema,
} from '@b2b/validation/marketplace';
import { AuthService } from '../auth/auth.service.js';
import { MarketplaceService } from './marketplace.service.js';

const cookie = (req: Request) => {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('b2b_session='));
  return value ? decodeURIComponent(value.slice(12)) : undefined;
};
const origin = (value?: string) => {
  if (value && value !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
    throw new BadRequestException('Invalid origin');
};

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    @Inject(MarketplaceService)
    private readonly marketplace: MarketplaceService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  @Get('search') search(@Query() query: unknown) {
    const result = marketplaceQuerySchema.safeParse(query);
    if (!result.success) throw new BadRequestException('Invalid search');
    return this.marketplace.search(result.data);
  }
  @Post('compare') async compare(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    origin(requestOrigin);
    const user = await this.auth.requireSession(cookie(req), csrf ?? '');
    await this.auth.assertApprovedBusinessUser(user);
    const result = comparisonSchema.safeParse(body);
    if (!result.success) throw new BadRequestException('Invalid comparison');
    return this.marketplace.compare(result.data.packageIds);
  }
}
