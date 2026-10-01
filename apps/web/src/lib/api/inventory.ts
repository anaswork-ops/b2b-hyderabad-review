import { API } from './auth';
const csrf = () =>
  decodeURIComponent(
    document.cookie.match(/(?:^|; )b2b_csrf=([^;]+)/)?.[1] ?? '',
  );
export async function inventoryRequest<T>(
  path: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
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
export async function uploadPackageMedia(
  packageId: string,
  file: File,
  kind: 'IMAGE' | 'BROCHURE' | 'DOCUMENT',
  isPublic: boolean,
) {
  const response = await fetch(`${API}/inventory/packages/${packageId}/media`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': file.type,
      'X-CSRF-Token': csrf(),
      'X-Media-Kind': kind,
      'X-File-Name': file.name,
      'X-Media-Public': String(isPublic),
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
