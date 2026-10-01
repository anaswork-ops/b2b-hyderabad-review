import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
const fixtures = new SharedArray('isolated users', () =>
  JSON.parse(open(__ENV.FIXTURES)),
);
const bases = (__ENV.API_BASES || __ENV.API_BASE || '')
  .split(',')
  .filter(Boolean);
if (!bases.length || !__ENV.ALLOW_ISOLATED_LOAD || fixtures.length < 500)
  throw new Error('Explicit isolated target and 500 fixtures required');
export const options = {
  scenarios: {
    marketplace: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 },
        { duration: __ENV.HOLD_DURATION || '3m', target: 500 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{kind:normal}': ['p(95)<=1000'],
    'http_req_duration{kind:search}': ['p(95)<=2000'],
  },
};
export default function () {
  const base = bases[(__VU - 1) % bases.length];
  const f = fixtures[(__VU - 1) % fixtures.length],
    n = (__ITER + __VU) % 20;
  const headers = {
    Cookie: `b2b_session=${f.token}`,
    'X-CSRF-Token': f.csrf,
    'Content-Type': 'application/json',
  };
  // Isolated harness emulates a trusted ingress with a distinct IP per active user.
  if (__ENV.EMULATE_INGRESS === '1')
    headers['X-Forwarded-For'] =
      `10.88.${Math.floor(__VU / 250)}.${(__VU % 250) + 1}`;
  let response;
  if (n < 10) {
    const paths = [
      '/marketplace/search?market=India&mode=packages',
      '/marketplace/search?market=India&mode=services',
      '/verticals/search?vertical=tourism&market=India',
      '/verticals/search?vertical=visa&market=India',
      '/marketplace/search?market=India&startDate=2026-10-01&endDate=2026-10-15',
    ];
    response = http.get(base + paths[n % paths.length], {
      headers,
      tags: { kind: 'search', name: 'marketplace_search' },
    });
  } else if (n < 14)
    response = http.get(`${base}/businesses/public/${f.slug}`, {
      headers,
      tags: { kind: 'normal', name: 'public_profile' },
    });
  else if (n < 16)
    response = http.get(`${base}/auth/session`, {
      headers,
      tags: { kind: 'normal', name: 'session' },
    });
  else if (n < 18)
    response = http.post(
      `${base}/marketplace/compare`,
      JSON.stringify({ packageIds: f.packageIds }),
      { headers, tags: { kind: 'normal', name: 'comparison' } },
    );
  else if (n === 18)
    response = http.get(`${base}/messages`, {
      headers,
      tags: { kind: 'normal', name: 'inbox' },
    });
  else
    response = http.post(
      `${base}/messages/${f.conversationId}/send`,
      JSON.stringify({ body: `Isolated load enquiry ${__VU}/${__ITER}` }),
      { headers, tags: { kind: 'normal', name: 'message_write' } },
    );
  check(response, {
    'successful business response': (r) => r.status >= 200 && r.status < 300,
  });
  sleep(
    Number(__ENV.THINK_MIN || 3) +
      Math.random() * Number(__ENV.THINK_SPREAD || 4),
  );
}
export function handleSummary(data) {
  return {
    [__ENV.SUMMARY_PATH || '/results/summary.json']: JSON.stringify(
      data,
      null,
      2,
    ),
  };
}
