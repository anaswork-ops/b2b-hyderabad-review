export async function apiHealth(): Promise<string> {
  try {
    const response = await fetch(
      new URL(
        'health',
        (process.env.API_ORIGIN ?? 'http://localhost:3001').replace(
          /\/?$/,
          '/',
        ),
      ),
      { cache: 'no-store', signal: AbortSignal.timeout(2500) },
    );
    return response.ok ? 'reachable' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
