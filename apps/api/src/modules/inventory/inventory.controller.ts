import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  lifecycleSchema,
  offerSchema,
  packageSchema,
  serviceSchema,
} from '@b2b/validation/inventory';
import { AuthService } from '../auth/auth.service.js';
import { InventoryService } from './inventory.service.js';

const cookie = (req: Request) => {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('b2b_session='));
  return value ? decodeURIComponent(value.slice(12)) : undefined;
};
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid request');
  return result.data;
};
const origin = (value?: string) => {
  if (value && value !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000'))
    throw new BadRequestException('Invalid origin');
};

@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}
  private session(req: Request, csrf?: string) {
    return this.auth.requireSession(cookie(req), csrf);
  }
  private async mutation(req: Request, requestOrigin?: string, csrf?: string) {
    origin(requestOrigin);
    return this.session(req, csrf ?? '');
  }
  @Get() async list(@Req() req: Request) {
    return this.inventory.list(await this.session(req));
  }
  @Post('packages') async createPackage(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.createPackage(
      await this.mutation(req, o, csrf),
      parse(packageSchema, body),
    );
  }
  @Put('packages/:id') async updatePackage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.updatePackage(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      parse(packageSchema, body),
    );
  }
  @Post('packages/:id/lifecycle') async packageLifecycle(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    const input = parse(lifecycleSchema, body);
    return this.inventory.packageLifecycle(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      input.action,
    );
  }
  @Post('packages/:id/duplicate') async duplicate(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.duplicatePackage(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
    );
  }
  @Delete('packages/:id') async deletePackage(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.deleteDraftPackage(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
    );
  }
  @Post('services') async createService(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.createService(
      await this.mutation(req, o, csrf),
      parse(serviceSchema, body),
    );
  }
  @Put('services/:id') async updateService(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.updateService(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      parse(serviceSchema, body),
    );
  }
  @Post('services/:id/lifecycle') async serviceLifecycle(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    const input = parse(lifecycleSchema, body);
    return this.inventory.serviceLifecycle(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      input.action,
    );
  }
  @Delete('services/:id') async deleteService(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.deleteDraftService(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
    );
  }
  @Post('offers') async createOffer(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.createOffer(
      await this.mutation(req, o, csrf),
      parse(offerSchema, body),
    );
  }
  @Put('offers/:id') async updateOffer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.updateOffer(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
      parse(offerSchema, body),
    );
  }
  @Delete('offers/:id') async deleteOffer(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
  ) {
    return this.inventory.deleteOffer(
      await this.mutation(req, o, csrf),
      parse(z.guid(), id),
    );
  }
  @Post('packages/:id/media') async uploadMedia(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('origin') o?: string,
    @Headers('x-csrf-token') csrf?: string,
    @Headers('x-media-kind') kind?: string,
    @Headers('x-file-name') filename?: string,
    @Headers('x-media-public') publicValue?: string,
    @Headers('content-type') contentType?: string,
  ) {
    const user = await this.mutation(req, o, csrf);
    if (!Buffer.isBuffer(req.body))
      throw new BadRequestException('Invalid media body');
    return this.inventory.uploadPackageMedia(user, parse(z.guid(), id), {
      kind: parse(z.enum(['IMAGE', 'BROCHURE', 'DOCUMENT']), kind),
      filename: parse(z.string().trim().min(1).max(255), filename),
      contentType: contentType ?? '',
      isPublic: publicValue === 'true',
      bytes: req.body,
    });
  }
  @Get('packages/:packageId/media/:id') async media(
    @Req() req: Request,
    @Res() res: Response,
    @Param('packageId') packageId: string,
    @Param('id') id: string,
  ) {
    const result = await this.inventory.packageMedia(
      await this.session(req),
      parse(z.guid(), packageId),
      parse(z.guid(), id),
    );
    this.send(res, result);
  }
  @Get('public/:slug/packages/:packageId/media/:id') async publicMedia(
    @Res() res: Response,
    @Param('slug') slug: string,
    @Param('packageId') packageId: string,
    @Param('id') id: string,
  ) {
    const result = await this.inventory.publicPackageMedia(
      parse(
        z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(120),
        slug,
      ),
      parse(z.guid(), packageId),
      parse(z.guid(), id),
    );
    this.send(res, result);
  }
  private send(
    res: Response,
    media: { contentType: string; filename: string; bytes: Buffer },
  ) {
    res.setHeader('Content-Type', media.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${media.filename.replace(/["\\]/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(media.bytes);
  }
}
