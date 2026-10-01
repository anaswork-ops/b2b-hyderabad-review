export type Delivery = {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  text: string;
};
export class DeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

/** The configured gateway must implement the documented idempotent delivery contract. */
export async function deliver(message: Delivery) {
  const prefix = message.channel === 'EMAIL' ? 'EMAIL' : 'MOBILE';
  const endpoint = process.env[`${prefix}_DELIVERY_URL`];
  const key = process.env[`${prefix}_DELIVERY_KEY`];
  if (!endpoint || !key)
    throw new DeliveryError('provider_not_configured', false);
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' &&
    !(
      process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    throw new DeliveryError('provider_config_invalid', false);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'Idempotency-Key': message.id,
      },
      body: JSON.stringify(message),
    });
  } catch {
    throw new DeliveryError('provider_unavailable', true);
  }
  // Never log provider response bodies: they can echo addresses or verification links.
  await response.body?.cancel();
  if (!response.ok)
    throw new DeliveryError(
      'provider_rejected',
      response.status === 429 || response.status >= 500,
    );
}
