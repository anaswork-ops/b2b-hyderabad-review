import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  conversationSearchSchema,
  customRequestSchema,
  reportSchema,
  sendMessageSchema,
  startConversationSchema,
} from '@b2b/validation/messaging';
import { AuthService } from '../auth/auth.service.js';
import { MessagingService } from './messaging.service.js';
const cookie = (req: Request) => {
  const v = req.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('b2b_session='));
  return v ? decodeURIComponent(v.slice(12)) : undefined;
};
const parse = <T>(schema: z.ZodType<T>, value: unknown) => {
  const r = schema.safeParse(value);
  if (!r.success) throw new BadRequestException('Invalid request');
  return r.data;
};
const origin = (v?: string) => {
  if (v && v !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
    throw new BadRequestException('Invalid origin');
};
@Controller('messages')
export class MessagingController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(MessagingService) private readonly messaging: MessagingService,
  ) {}
  private session(req: Request, csrf?: string) {
    return this.auth.requireSession(cookie(req), csrf);
  }
  private mutation(req: Request, o?: string, csrf?: string) {
    origin(o);
    return this.session(req, csrf ?? '');
  }
  @Get() async list(@Req() req: Request, @Query() query: unknown) {
    const q = parse(conversationSearchSchema, query);
    return this.messaging.list(await this.session(req), q.q);
  }
  @Get(':id') async detail(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.detail(await this.session(req), parse(z.guid(), id));
  }
  @Post() async start(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.messaging.start(
      await this.mutation(req, o, csrf),
      parse(startConversationSchema, body),
    );
  }
  @Post('custom-requests') async custom(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.messaging.custom(
      await this.mutation(req, o, csrf),
      parse(customRequestSchema, body),
    );
  }
  @Post(':id/send') async send(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    const x = parse(sendMessageSchema, body);
    return this.messaging.send(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      x.body,
    );
  }
  @Post(':id/block') async block(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.messaging.block(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
    );
  }
  @Post(':id/custom-request/close') async close(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.messaging.close(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
    );
  }
  @Post(':id/report') async report(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    const x = parse(reportSchema, body);
    return this.messaging.report(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      x.reason,
    );
  }
  @Post(':conversationId/messages/:messageId/attachments') async upload(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
    @Headers('x-file-name') filename?: string,
    @Headers('content-type') contentType?: string,
  ) {
    const user = await this.mutation(req, o, csrf);
    return this.messaging.attach(
      user,
      parse(z.guid(), conversationId),
      parse(z.guid(), messageId),
      filename ?? '',
      (req.headers['x-upload-content-type'] as string | undefined) ??
        contentType ??
        '',
      req.body,
    );
  }
  @Get(':conversationId/attachments/:id') async attachment(
    @Req() req: Request,
    @Res() res: Response,
    @Param('conversationId') conversationId: string,
    @Param('id') id: string,
  ) {
    const x = await this.messaging.attachment(
      await this.session(req),
      parse(z.guid(), conversationId),
      parse(z.guid(), id),
    );
    res.setHeader('Content-Type', x.contentType);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + x.filename.replace(/["\\]/g, '') + '"',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    if (x.url) {
      res.redirect(302, x.url);
      return;
    }
    res.send(x.bytes);
  }
}
