import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';

const { callback } = vi.hoisted(() => ({ callback: vi.fn() }));
vi.mock('@vercel/queue', () => ({
  QueueClient: class {
    handleCallback() {
      return callback;
    }
  },
}));
import handler from '../src/vercel.js';

afterEach(() => vi.clearAllMocks());
it('passes raw queue payload and headers through the Web callback and writes its response', async () => {
  callback.mockImplementation(async (request: Request) => {
    expect(request.method).toBe('POST');
    expect(request.headers.get('ce-type')).toBe('test.queue');
    expect(await request.text()).toBe('{"intentId":"review"}');
    return Response.json({ status: 'success' }, { status: 202 });
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      {
        method: 'POST',
        headers: { 'ce-type': 'test.queue' },
        body: '{"intentId":"review"}',
      },
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'success' });
    expect(callback).toHaveBeenCalledOnce();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
