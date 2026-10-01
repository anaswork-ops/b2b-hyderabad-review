export const API =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:3001';
export async function authRequest(
  path: string,
  body?: object,
  method = 'POST',
) {
  const response = await fetch(`${API}/auth/${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method === 'POST'
        ? {
            'X-CSRF-Token':
              document.cookie.match(/(?:^|; )b2b_csrf=([^;]+)/)?.[1] ?? '',
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}
