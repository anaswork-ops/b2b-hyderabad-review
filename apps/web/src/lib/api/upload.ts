// The API authorizes the resource before issuing a short-lived private upload.
export async function uploadFile(
  url: string,
  file: File,
  headers: Record<string, string>,
) {
  if (process.env.NEXT_PUBLIC_STORAGE_DRIVER !== 'vercel-blob')
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: file,
    });
  const jsonHeaders = {
    ...headers,
    'Content-Type': 'application/json',
    'X-Upload-Content-Type': file.type,
  };
  const prepared = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ prepare: true, size: file.size }),
  });
  if (!prepared.ok) return prepared;
  const grant = (await prepared.json()) as {
    uploadUrl: string;
    upload: string;
  };
  const uploaded = await fetch(grant.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploaded.ok) throw new Error('Upload failed. Please try again.');
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ upload: grant.upload }),
  });
}
