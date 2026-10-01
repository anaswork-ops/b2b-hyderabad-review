import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Query,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  applicationDraftSchema,
  reviewSchema,
  documentRequirementSchema,
} from '@b2b/validation/application';
import { AuthService } from '../auth/auth.service.js';
import { ApplicationsService } from './applications.service.js';

function cookie(req: Request, name: string) {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
}
function origin(value?: string) {
  if (value && value !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
    throw new BadRequestException('Invalid origin');
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Invalid request');
  return result.data;
}

@Controller('applications')
export class ApplicationsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ApplicationsService)
    private readonly applications: ApplicationsService,
  ) {}
  private session(req: Request, csrf?: string) {
    return this.auth.requireSession(cookie(req, 'b2b_session'), csrf);
  }
  @Get('mine')
  async mine(@Req() req: Request) {
    return this.applications.mine(await this.session(req));
  }
  @Patch('mine')
  async save(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    origin(requestOrigin);
    return this.applications.save(
      await this.session(req, csrf ?? ''),
      parse(applicationDraftSchema, body),
    );
  }
  @Get('mine/notifications')
  async notifications(@Req() req: Request) {
    return this.applications.notificationsFor(await this.session(req));
  }
  @Get('mine/preview')
  async preview(@Req() req: Request) {
    return this.applications.preview(await this.session(req));
  }
  @Post('mine/submit')
  async submit(
    @Req() req: Request,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    origin(requestOrigin);
    return this.applications.submit(await this.session(req, csrf ?? ''));
  }
  @Post('mine/documents')
  async upload(
    @Req() req: Request,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
    @Headers('x-document-kind') kind?: string,
    @Headers('x-file-name') filename?: string,
    @Headers('content-type') contentType?: string,
  ) {
    origin(requestOrigin);
    const user = await this.session(req, csrf ?? '');
    if (!Buffer.isBuffer(req.body))
      throw new BadRequestException('Invalid document body');
    return this.applications.upload(
      user,
      parse(z.enum(['REGISTRATION_LICENCE', 'SUPPORTING']), kind),
      filename ?? '',
      contentType ?? '',
      req.body,
    );
  }
  @Get('mine/documents/:id')
  async myDocument(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const result = await this.applications.document(
      await this.session(req),
      parse(z.guid(), id),
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(result.bytes);
  }
  @Get('admin/:applicationId/documents/:id')
  async adminDocument(
    @Req() req: Request,
    @Res() res: Response,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
  ) {
    const user = await this.session(req);
    await this.auth.assertRole(user, 'ADMIN');
    const result = await this.applications.document(
      user,
      parse(z.guid(), id),
      parse(z.guid(), applicationId),
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(result.bytes);
  }
  @Get('admin/requirements')
  async requirements(@Req() req: Request) {
    await this.auth.assertRole(await this.session(req), 'ADMIN');
    return this.applications.listRequirements();
  }
  @Post('admin/requirements')
  async setRequirement(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    origin(requestOrigin);
    const user = await this.session(req, csrf ?? '');
    await this.auth.assertRole(user, 'ADMIN');
    return this.applications.setRequirement(
      user,
      parse(documentRequirementSchema, body),
    );
  }
  @Get('admin')
  async list(@Req() req: Request, @Query('page') page?: string) {
    await this.auth.assertRole(await this.session(req), 'ADMIN');
    return this.applications.list(
      undefined,
      parse(z.coerce.number().int().min(1).max(10000).default(1), page),
    );
  }
  @Get('admin/:id')
  async detail(@Req() req: Request, @Param('id') id: string) {
    await this.auth.assertRole(await this.session(req), 'ADMIN');
    return this.applications.adminDetail(parse(z.guid(), id));
  }
  @Post('admin/:id/review')
  async review(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') requestOrigin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    origin(requestOrigin);
    const user = await this.session(req, csrf ?? '');
    await this.auth.assertRole(user, 'ADMIN');
    return this.applications.review(
      user,
      parse(z.guid(), id),
      parse(reviewSchema, body),
    );
  }
}
