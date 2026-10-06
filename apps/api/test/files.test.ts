import { afterEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  issueSignedToken: vi.fn(async () => ({
    clientSigningToken: 'fixture',
    delegationToken: 'fixture',
  })),
  presignUrl: vi.fn(async () => ({
    presignedUrl: 'https://storage.example.test/signed',
  })),
  get: vi.fn(),
  del: vi.fn(async () => {}),
  put: vi.fn(),
  list: vi.fn(),
}));
vi.mock('@vercel/blob', () => sdk);
import { FilesService } from '../src/modules/files/files.service.js';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.useRealTimers();
});
function files() {
  vi.stubEnv('STORAGE_DRIVER', 'vercel-blob');
  vi.stubEnv('AUTH_ENCRYPTION_KEY', 'ab'.repeat(32));
  return new FilesService();
}
it('restricts upload URLs to a private random path, MIME type, size and expiry', async () => {
  const service = files();
  const grant = await service.receive(
    'owner',
    { prepare: true, size: 5 * 1024 * 1024 },
    'application/pdf',
  );
  expect(Buffer.isBuffer(grant)).toBe(false);
  expect(sdk.issueSignedToken).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: expect.stringMatching(/^temporary\/owner\/[a-f0-9-]+$/),
      operations: ['put'],
      maximumSizeInBytes: 5 * 1024 * 1024,
      allowedContentTypes: ['application/pdf'],
    }),
  );
  expect(sdk.presignUrl).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
    }),
  );
  await expect(
    service.receive(
      'owner',
      { prepare: true, size: 5 * 1024 * 1024 + 1 },
      'application/pdf',
    ),
  ).rejects.toThrow();
  await expect(
    service.receive('owner', { prepare: true, size: 0 }, 'application/pdf'),
  ).rejects.toThrow();
  await expect(
    service.receive('owner', { prepare: true, size: 10 }, 'text/html'),
  ).rejects.toThrow();
  expect(sdk.issueSignedToken).toHaveBeenCalledTimes(1);
});
it('rejects cross-user, MIME-switched, tampered and expired grants before reading storage', async () => {
  const service = files();
  const grant = await service.receive(
    'owner',
    { prepare: true, size: 5 },
    'application/pdf',
  );
  if (Buffer.isBuffer(grant)) throw new Error('Grant missing');
  await expect(
    service.receive('other', { upload: grant.upload }, 'application/pdf'),
  ).rejects.toThrow();
  await expect(
    service.receive('owner', { upload: grant.upload }, 'image/png'),
  ).rejects.toThrow();
  await expect(
    service.receive('owner', { upload: grant.upload + 'x' }, 'application/pdf'),
  ).rejects.toThrow();
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 11 * 60 * 1000);
  await expect(
    service.receive('owner', { upload: grant.upload }, 'application/pdf'),
  ).rejects.toThrow();
  expect(sdk.get).not.toHaveBeenCalled();
});
it('reads and removes the granted temporary object and validates its actual size', async () => {
  const service = files();
  const grant = await service.receive(
    'owner',
    { prepare: true, size: 5 },
    'application/pdf',
  );
  if (Buffer.isBuffer(grant)) throw new Error('Grant missing');
  sdk.get.mockResolvedValue({
    statusCode: 200,
    blob: { size: 5 },
    stream: new Response('%PDF-').body,
  });
  expect(
    await service.receive('owner', { upload: grant.upload }, 'application/pdf'),
  ).toEqual(Buffer.from('%PDF-'));
  expect(sdk.del).toHaveBeenCalledTimes(1);
});
it('keeps local raw uploads compatible and issues only short-lived read permission for downloads', async () => {
  const service = files();
  const content = Buffer.from('%PDF-');
  expect(await service.receive('owner', content, 'application/pdf')).toBe(
    content,
  );
  await service.download('applications/owned/file');
  expect(sdk.issueSignedToken).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: 'applications/owned/file',
      operations: ['get'],
    }),
  );
  const options = sdk.issueSignedToken.mock.calls[0]?.[0] as unknown as {
    validUntil: number;
  };
  expect(options.validUntil - Date.now()).toBeLessThanOrEqual(60000);
  vi.stubEnv('STORAGE_DRIVER', 's3');
  await expect(
    new FilesService().receive(
      'owner',
      { prepare: true, size: 5 },
      'application/pdf',
    ),
  ).rejects.toThrow();
});
