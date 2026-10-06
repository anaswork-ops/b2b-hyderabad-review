import { uploadFile } from './upload';
import { API } from './auth';

const csrf = () =>
  decodeURIComponent(
    document.cookie.match(/(?:^|; )b2b_csrf=([^;]+)/)?.[1] ?? '',
  );

export async function messageRequest<T>(
  path = '',
  method = 'GET',
  body?: object,
): Promise<T> {
  const response = await fetch(`${API}/messages${path ? '/' + path : ''}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrf() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error('SIGN_IN_REQUIRED');
    throw new Error(
      typeof data.message === 'string' ? data.message : 'Request failed',
    );
  }
  return data as T;
}

export async function uploadMessageAttachment(
  conversationId: string,
  messageId: string,
  file: File,
) {
  const response = await uploadFile(
    `${API}/messages/${conversationId}/messages/${messageId}/attachments`,
    file,
    {
      'Content-Type': file.type,
      'X-CSRF-Token': csrf(),
      'X-File-Name': file.name,
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.message === 'string' ? data.message : 'Upload failed',
    );
  return data;
}

export const attachmentUrl = (conversationId: string, id: string) =>
  `${API}/messages/${conversationId}/attachments/${id}`;
