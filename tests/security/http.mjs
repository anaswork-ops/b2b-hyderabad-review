import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.env.SECURITY_API_BASE;
if (!base || process.env.ALLOW_ISOLATED_SECURITY !== '1')
  throw new Error('Explicit isolated security target required');
const fixtures = JSON.parse(
  readFileSync(process.env.SECURITY_FIXTURES, 'utf8'),
);
const identity = fixtures[0];
const headers = {
  'X-Forwarded-For': '10.89.0.1',
  'Content-Type': 'application/json',
};
let passed = 0;
async function call(path, options = {}) {
  return fetch(base + path, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
}
async function test(name, run) {
  await run();
  passed++;
  console.log('PASS ' + name);
}
await test('security headers and disallowed CORS origin', async () => {
  const response = await call('/marketplace/search', {
    headers: { Origin: 'https://untrusted.example.test' },
  });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.notEqual(
    response.headers.get('access-control-allow-origin'),
    'https://untrusted.example.test',
  );
  assert.ok(response.headers.get('x-request-id'));
});
await test('anonymous admin denial', async () => {
  assert.equal((await call('/admin/dashboard')).status, 401);
});
await test('cross-origin mutation denial', async () => {
  assert.equal(
    (
      await call('/auth/login', {
        method: 'POST',
        headers: { Origin: 'https://untrusted.example.test' },
        body: JSON.stringify({
          email: 'none@example.test',
          password: 'Invalid-but-long-password',
        }),
      })
    ).status,
    400,
  );
});
await test('CSRF required for authenticated comparison', async () => {
  assert.equal(
    (
      await call('/marketplace/compare', {
        method: 'POST',
        headers: { Cookie: `b2b_session=${identity.token}` },
        body: JSON.stringify({ packageIds: identity.packageIds }),
      })
    ).status,
    403,
  );
});
await test('conversation ownership isolation', async () => {
  assert.equal(
    (
      await call(`/messages/${fixtures[1].conversationId}`, {
        headers: { Cookie: `b2b_session=${identity.token}` },
      })
    ).status,
    404,
  );
});
await test('bounded public search and error information', async () => {
  const response = await call(
    '/marketplace/search?startDate=0001-01-01&endDate=9999-12-31',
  );
  assert.equal(response.status, 400);
  const body = await response.text();
  assert.doesNotMatch(
    body,
    /Prisma|SELECT |passwordHash|stack|AUTH_ENCRYPTION_KEY/,
  );
});
await test('request size limit', async () => {
  assert.equal(
    (
      await call('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ padding: 'x'.repeat(110000) }),
      })
    ).status,
    413,
  );
});
await test('authentication abuse limit', async () => {
  let response;
  for (let i = 0; i < 11; i++)
    response = await call('/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.89.0.2' },
      body: JSON.stringify({
        email: 'abuse-fixture@example.test',
        password: 'Invalid-but-long-password',
      }),
    });
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('retry-after'));
});
await test('global abuse limit cannot be evaded with route changes', async () => {
  let response;
  for (let i = 0; i < 121; i++)
    response = await call(`/missing-${i}`, {
      headers: { 'X-Forwarded-For': '10.89.0.3' },
    });
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('retry-after'));
});
console.log(`${passed} real HTTP security checks passed.`);
