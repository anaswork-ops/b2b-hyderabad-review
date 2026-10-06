import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import * as blob from '@vercel/blob';
import { z } from 'zod';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class FilesService {
  private readonly hosted = process.env.STORAGE_DRIVER === 'vercel-blob';
  private sign(value: string) {
    return createHmac(
      'sha256',
      Buffer.from(process.env.AUTH_ENCRYPTION_KEY!, 'hex'),
    )
      .update('upload:' + value)
      .digest('base64url');
  }
  // Called only after the owning service has authorized this resource.
  async receive(userId: string, body: unknown, contentType: string) {
    if (Buffer.isBuffer(body)) return body;
    if (!this.hosted) throw new BadRequestException('Invalid upload body');
    const request = z
      .union([
        z
          .object({
            prepare: z.literal(true),
            size: z
              .number()
              .int()
              .min(1)
              .max(5 * 1024 * 1024),
          })
          .strict(),
        z.object({ upload: z.string().max(2048) }).strict(),
      ])
      .safeParse(body);
    if (
      !request.success ||
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
        contentType,
      )
    )
      throw new BadRequestException('Invalid upload request');
    if ('prepare' in request.data) {
      const pathname = `temporary/${userId}/${randomUUID()}`;
      const expires = Date.now() + 10 * 60 * 1000;
      const constraints = {
        pathname,
        validUntil: expires,
        allowedContentTypes: [contentType],
        maximumSizeInBytes: request.data.size,
      };
      const token = await blob.issueSignedToken({
        ...constraints,
        operations: ['put'],
      });
      const { presignedUrl } = await blob.presignUrl(token, {
        ...constraints,
        operation: 'put',
        access: 'private',
        allowOverwrite: false,
        addRandomSuffix: false,
      });
      const payload = Buffer.from(
        JSON.stringify({
          pathname,
          userId,
          contentType,
          expires,
          size: request.data.size,
        }),
      ).toString('base64url');
      return {
        uploadUrl: presignedUrl,
        upload: payload + '.' + this.sign(payload),
      };
    }
    const [payload, signature, extra] = request.data.upload.split('.');
    const actual = Buffer.from(signature ?? '');
    const expected = Buffer.from(this.sign(payload ?? ''));
    if (
      !payload ||
      extra ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new BadRequestException('Invalid upload grant');
    let grant: {
      pathname: string;
      userId: string;
      contentType: string;
      expires: number;
      size: number;
    };
    try {
      grant = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
      throw new BadRequestException('Invalid upload grant');
    }
    if (
      grant.userId !== userId ||
      grant.contentType !== contentType ||
      grant.expires <= Date.now()
    )
      throw new BadRequestException('Expired or mismatched upload grant');
    const bytes = await this.get(grant.pathname);
    await this.delete(grant.pathname);
    if (bytes.length !== grant.size)
      throw new BadRequestException('Upload size mismatch');
    return bytes;
  }
  async download(key: string): Promise<{ bytes?: Buffer; url?: string }> {
    if (!this.hosted) return { bytes: await this.get(key) };
    const token = await blob.issueSignedToken({
      pathname: key,
      operations: ['get'],
      validUntil: Date.now() + 60000,
    });
    const { presignedUrl } = await blob.presignUrl(token, {
      operation: 'get',
      pathname: key,
      access: 'private',
    });
    return { url: presignedUrl };
  }
  async healthy() {
    try {
      if (this.hosted)
        await blob.list({ limit: 1, abortSignal: AbortSignal.timeout(2000) });
      else
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), {
          abortSignal: AbortSignal.timeout(2000),
        });
      return true;
    } catch {
      return false;
    }
  }
  async cleanupTemporary() {
    if (!this.hosted) return;
    const result = await blob.list({ prefix: 'temporary/', limit: 1000 });
    const expired = result.blobs.filter(
      (x) => x.uploadedAt.getTime() < Date.now() - 20 * 60 * 1000,
    );
    if (expired.length) await blob.del(expired.map((x) => x.url));
  }

  private readonly bucket = process.env.S3_BUCKET ?? 'local-development';
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
  async put(key: string, bytes: Buffer, contentType: string) {
    if (this.hosted) {
      await blob.put(key, bytes, {
        access: 'private',
        contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return;
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      if (
        process.env.NODE_ENV === 'production' ||
        (error as { name?: string }).name !== 'NoSuchBucket'
      )
        throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );
    }
  }
  async get(key: string) {
    if (this.hosted) {
      const result = await blob.get(key, {
        access: 'private',
        useCache: false,
      });
      if (!result || result.statusCode !== 200)
        throw new BadRequestException('File unavailable');
      if (result.blob.size > 5 * 1024 * 1024) {
        await result.stream.cancel();
        throw new BadRequestException('File too large');
      }
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    }
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('Document unavailable');
    return Buffer.from(await response.Body.transformToByteArray());
  }
  async delete(key: string) {
    if (this.hosted) {
      await blob.del(key);
      return;
    }
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
