import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { lifecycleSchema } from '@b2b/validation/inventory';
import {
  tourismSchema,
  verticalSearchSchema,
  visaSchema,
} from '@b2b/validation/verticals';
import { AuthService } from '../auth/auth.service.js';
import { VerticalsService } from './verticals.service.js';
const cookie = (r: Request) => {
    const v = r.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('b2b_session='));
    return v ? decodeURIComponent(v.slice(12)) : undefined;
  },
  parse = <T>(s: z.ZodType<T>, v: unknown) => {
    const r = s.safeParse(v);
    if (!r.success) throw new BadRequestException('Invalid request');
    return r.data;
  };
@Controller('verticals')
export class VerticalsController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(VerticalsService) private service: VerticalsService,
  ) {}
  private session(r: Request, csrf?: string) {
    return this.auth.requireSession(cookie(r), csrf);
  }
  private mutation(r: Request, o?: string, c?: string) {
    if (o && o !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
      throw new BadRequestException('Invalid origin');
    return this.session(r, c ?? '');
  }
  @Get('search') search(@Query() q: unknown) {
    return this.service.search(parse(verticalSearchSchema, q));
  }
  @Get(':kind/:id') detail(@Param('kind') k: string, @Param('id') id: string) {
    return this.service.detail(
      parse(z.enum(['tourism', 'visa']), k),
      parse(z.guid(), id),
    );
  }
  @Get() async mine(@Req() r: Request) {
    return this.service.mine(await this.session(r));
  }
  @Post('tourism') async ct(
    @Req() r: Request,
    @Body() b: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') c?: string,
  ) {
    return this.service.createTourism(
      await this.mutation(r, o, c),
      parse(tourismSchema, b),
    );
  }
  @Post('visa') async cv(
    @Req() r: Request,
    @Body() b: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') c?: string,
  ) {
    return this.service.createVisa(
      await this.mutation(r, o, c),
      parse(visaSchema, b),
    );
  }
  @Put(':kind/:id') async update(
    @Req() r: Request,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() b: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') c?: string,
  ) {
    const kind = parse(z.enum(['tourism', 'visa']), k);
    const user = await this.mutation(r, o, c),
      listingId = parse(z.guid(), id);
    return kind === 'tourism'
      ? this.service.update(user, kind, listingId, parse(tourismSchema, b))
      : this.service.update(user, kind, listingId, parse(visaSchema, b));
  }
  @Post(':kind/:id/lifecycle') async life(
    @Req() r: Request,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() b: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') c?: string,
  ) {
    return this.service.lifecycle(
      await this.mutation(r, o, c),
      parse(z.enum(['tourism', 'visa']), k),
      parse(z.guid(), id),
      parse(lifecycleSchema, b).action,
    );
  }
}
