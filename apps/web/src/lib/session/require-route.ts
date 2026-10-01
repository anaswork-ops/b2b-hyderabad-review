import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function requireRoute(allowed: '/admin' | '/business' | '/apply') {
  const cookie = (await headers()).get('cookie') ?? '';
  const origin = process.env.API_ORIGIN ?? 'http://localhost:3001';
  const response = await fetch(`${origin}/auth/session`, {
    headers: { cookie },
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) redirect('/login');
  const session = await response.json();
  if (session.route !== allowed) redirect(session.route);
  if (allowed === '/admin') {
    const access = await fetch(`${origin}/auth/access/admin`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!access.ok) redirect('/login');
  }
  return session;
}
