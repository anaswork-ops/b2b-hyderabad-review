import { API } from './auth';
const csrf = () =>
  decodeURIComponent(
    document.cookie.match(/(?:^|; )b2b_csrf=([^;]+)/)?.[1] ?? '',
  );
export async function marketSearch(query: URLSearchParams) {
  const mode = query.get('mode');
  if (mode === 'tourism' || mode === 'visa') {
    const vertical = new URLSearchParams();
    for (const key of [
      'market',
      'destination',
      'category',
      'startDate',
      'endDate',
      'groupSize',
      'pricingMode',
      'currency',
      'maxPrice',
      'page',
      'pageSize',
    ]) {
      const value = query.get(key);
      if (value) vertical.set(key, value);
    }
    vertical.set('vertical', mode);
    const response = await fetch(API + '/verticals/search?' + vertical, {
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? 'Search failed');
    return data;
  }
  const response = await fetch(
    API + '/marketplace/search?' + query.toString(),
    { credentials: 'include' },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? 'Search failed');
  return data;
}
export async function comparePackages(ids: string[]) {
  const response = await fetch(API + '/marketplace/compare', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
    body: JSON.stringify({ packageIds: ids }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403)
    throw new Error('SIGN_IN_REQUIRED');
  if (!response.ok) throw new Error(data.message ?? 'Comparison failed');
  return data;
}
