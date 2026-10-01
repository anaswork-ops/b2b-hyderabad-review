import { API } from './auth';
const csrf = () =>
  decodeURIComponent(
    document.cookie.match(/(?:^|; )b2b_csrf=([^;]+)/)?.[1] ?? '',
  );
export async function applicationRequest<T>(
  path: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const response = await fetch(`${API}/applications/${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrf() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.message === 'string' ? data.message : 'Request failed',
    );
  return data as T;
}
export async function uploadApplicationDocument(
  file: File,
  kind: 'REGISTRATION_LICENCE' | 'SUPPORTING',
) {
  const response = await fetch(`${API}/applications/mine/documents`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': file.type,
      'X-CSRF-Token': csrf(),
      'X-Document-Kind': kind,
      'X-File-Name': file.name,
    },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.message === 'string' ? data.message : 'Upload failed',
    );
  return data;
}
