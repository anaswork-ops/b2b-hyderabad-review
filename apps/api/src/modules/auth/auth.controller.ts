import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  credentialsSchema,
  emailOnlySchema,
  tokenSchema,
  challengeSchema,
  codeSchema,
  resetSchema,
} from '@b2b/validation/auth';
import { AuthService } from './auth.service.js';

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException('Invalid request');
  return result.data;
}
function cookie(req: Request, name: string): string | undefined {
  const item = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}
function assertOrigin(origin?: string) {
  if (origin && origin !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
    throw new BadRequestException('Invalid origin');
}
const production = () => process.env.NODE_ENV === 'production';
function setSession(
  res: Response,
  session: { token: string; csrf: string; expiresAt: Date },
) {
  res.cookie('b2b_session', session.token, {
    httpOnly: true,
    secure: production(),
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
  res.cookie('b2b_csrf', session.csrf, {
    httpOnly: false,
    secure: production(),
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertOrigin(origin);
    const input = parse(credentialsSchema, body);
    return this.auth.register(input.email, input.password);
  }

  @Post('email/resend')
  resend(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertOrigin(origin);
    const input = parse(emailOnlySchema, body);
    return this.auth.resendVerification(input.email);
  }

  @Post('email/verify')
  verifyEmail(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertOrigin(origin);
    return this.auth.verifyEmail(parse(tokenSchema, body).token);
  }

  @Post('password/forgot')
  forgot(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertOrigin(origin);
    return this.auth.forgotPassword(parse(emailOnlySchema, body).email);
  }

  @Post('mobile/request')
  async requestMobile(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    assertOrigin(origin);
    const user = await this.auth.requireSession(
      cookie(req, 'b2b_session'),
      csrf ?? '',
    );
    const input = parse(
      z.strictObject({ mobile: z.string().regex(/^\+[1-9]\d{7,14}$/) }),
      body,
    );
    return this.auth.requestMobile(user, input.mobile);
  }

  @Post('mobile/verify')
  async verifyMobile(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    assertOrigin(origin);
    const user = await this.auth.requireSession(
      cookie(req, 'b2b_session'),
      csrf ?? '',
    );
    return this.auth.verifyMobile(user, parse(tokenSchema, body).token);
  }

  @Post('password/reset')
  reset(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertOrigin(origin);
    const input = parse(resetSchema, body);
    return this.auth.resetPassword(input.token, input.password);
  }

  @Post('login')
  async login(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOrigin(origin);
    const input = parse(credentialsSchema, body);
    const result = await this.auth.login(input.email, input.password);
    if (result.mfaRequired) return result;
    setSession(res, result);
    return { mfaRequired: false };
  }

  @Post('mfa/setup')
  setup(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertOrigin(origin);
    return this.auth.mfaSetup(parse(challengeSchema, body).challenge);
  }

  @Post('mfa/verify')
  async verifyMfa(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOrigin(origin);
    const input = parse(codeSchema, body);
    const session = await this.auth.mfaVerify(input.challenge, input.code);
    setSession(res, session);
    return { message: 'Signed in' };
  }

  @Get('session')
  async session(@Req() req: Request) {
    const user = await this.auth.requireSession(cookie(req, 'b2b_session'));
    return {
      user: { id: user.id, email: user.email, role: user.role },
      ...(await this.auth.sessionContext(user)),
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('origin') origin?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    assertOrigin(origin);
    const token = cookie(req, 'b2b_session');
    await this.auth.requireSession(token, csrf ?? '');
    const result = await this.auth.logout(token);
    res.clearCookie('b2b_session', {
      path: '/',
      secure: production(),
      sameSite: 'lax',
    });
    res.clearCookie('b2b_csrf', {
      path: '/',
      secure: production(),
      sameSite: 'lax',
    });
    return result;
  }

  @Get('access/admin')
  async admin(@Req() req: Request) {
    const user = await this.auth.requireSession(cookie(req, 'b2b_session'));
    await this.auth.assertRole(user, 'ADMIN');
    return { authorized: true };
  }

  @Get('access/business/:id')
  async business(@Req() req: Request, @Param('id') id: string) {
    const user = await this.auth.requireSession(cookie(req, 'b2b_session'));
    await this.auth.assertApprovedOwner(user, id);
    return { authorized: true };
  }
}
