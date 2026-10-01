import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Header,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  adminQuerySchema,
  listingKindSchema,
  moderationSchema,
  businessStatusSchema,
  reportResolutionSchema,
} from '@b2b/validation/admin';
import { AuthService } from '../auth/auth.service.js';
import { AdminService } from './admin.service.js';
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid request');
  return result.data;
}
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}
  private async staff(req: Request, mutate = false) {
    if (
      mutate &&
      req.headers.origin &&
      req.headers.origin !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    )
      throw new BadRequestException('Invalid origin');
    const token = req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('b2b_session='))
      ?.slice(12);
    const user = await this.auth.requireSession(
      token,
      mutate ? String(req.headers['x-csrf-token'] ?? '') : undefined,
    );
    await this.auth.assertRole(user, 'ADMIN');
    return user;
  }
  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  async dashboard(@Req() req: Request) {
    await this.staff(req);
    return this.admin.dashboard();
  }
  @Get('health') @Header('Cache-Control', 'private, no-store') async health(
    @Req() req: Request,
  ) {
    await this.staff(req);
    return this.admin.health();
  }
  @Get('businesses')
  @Header('Cache-Control', 'private, no-store')
  async businesses(@Req() req: Request, @Query() query: unknown) {
    await this.staff(req);
    return this.admin.businesses.adminList(parse(adminQuerySchema, query));
  }
  @Get('businesses/:id')
  @Header('Cache-Control', 'private, no-store')
  async business(@Req() req: Request, @Param('id') id: string) {
    await this.staff(req);
    return this.admin.business(parse(z.guid(), id));
  }
  @Post('businesses/:id/status') async status(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const user = await this.staff(req, true),
      input = parse(businessStatusSchema, body);
    return this.admin.applications.changeBusinessStatus(
      user,
      parse(z.guid(), id),
      input.action,
      input.reason,
    );
  }
  @Get('users') @Header('Cache-Control', 'private, no-store') async users(
    @Req() req: Request,
    @Query() query: unknown,
  ) {
    await this.staff(req);
    return this.admin.users.adminList(parse(adminQuerySchema, query));
  }
  @Get('listings/:kind')
  @Header('Cache-Control', 'private, no-store')
  async listings(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Query() query: unknown,
  ) {
    await this.staff(req);
    return this.admin.listings(
      parse(listingKindSchema, kind),
      parse(adminQuerySchema, query),
    );
  }
  @Get('listings/:kind/:id')
  @Header('Cache-Control', 'private, no-store')
  async listing(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    await this.staff(req);
    return this.admin.listing(
      parse(listingKindSchema, kind),
      parse(z.guid(), id),
    );
  }
  @Post('listings/:kind/:id/moderation') async moderate(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const user = await this.staff(req, true),
      input = parse(moderationSchema, body);
    return this.admin.moderate(
      user,
      parse(listingKindSchema, kind),
      parse(z.guid(), id),
      input.hidden,
      input.reason,
    );
  }
  @Get('reports') @Header('Cache-Control', 'private, no-store') async reports(
    @Req() req: Request,
    @Query() query: unknown,
  ) {
    await this.staff(req);
    return this.admin.messaging.adminReports(parse(adminQuerySchema, query));
  }
  @Post('reports/:id/resolve') async resolve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const user = await this.staff(req, true),
      input = parse(reportResolutionSchema, body);
    return this.admin.messaging.resolveReport(
      user,
      parse(z.guid(), id),
      input.reason,
    );
  }
  @Get('audit') @Header('Cache-Control', 'private, no-store') async audit(
    @Req() req: Request,
    @Query() query: unknown,
  ) {
    await this.staff(req);
    return this.admin.audit.query(parse(adminQuerySchema, query));
  }
}
