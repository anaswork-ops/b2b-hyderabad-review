import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const key = () => Buffer.from(process.env.AUTH_ENCRYPTION_KEY!, 'hex');
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function decrypt(value: string): string {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}
export function totp(
  secret: string,
  counter = Math.floor(Date.now() / 30_000),
): string {
  const moving = Buffer.alloc(8);
  moving.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', Buffer.from(secret, 'base64url'))
    .update(moving)
    .digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, '0');
}
export function validTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const shift of [-1, 0, 1]) {
    if (
      timingSafeEqual(
        Buffer.from(totp(secret, Math.floor(Date.now() / 30_000) + shift)),
        Buffer.from(code),
      )
    )
      return true;
  }
  return false;
}
