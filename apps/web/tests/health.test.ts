import { afterEach, expect, it, vi } from 'vitest';
import { apiHealth } from '../src/lib/api/health';
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
it('shows unavailable when the API cannot be reached', async () => {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
  expect(await apiHealth()).toBe('unavailable');
});
