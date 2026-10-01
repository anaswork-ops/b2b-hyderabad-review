import { API } from './auth';
export async function adminRequest<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`${API}/admin/${path}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(body
        ? {
            'X-CSRF-Token': decodeURIComponent(
              document.cookie.match(/(?:^|; )b2b_csrf=([^;]+)/)?.[1] ?? '',
            ),
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof result.message === 'string' ? result.message : 'Request failed',
    );
  return result as T;
}
