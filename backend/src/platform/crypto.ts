import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from 'node:crypto';
export const hashToken = (s: string) =>
  createHash('sha256').update(s).digest('hex');
export function encrypt(value: unknown): string {
  const key = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error('PAYMENT_ENCRYPTION_KEY must be 32 bytes in hex');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    bytes.toString('hex'),
  ].join('.');
}
export function decrypt(value: string): any {
  const [iv, tag, bytes] = value.split('.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.PAYMENT_ENCRYPTION_KEY ?? '', 'hex'),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(bytes, 'hex')),
      decipher.final(),
    ]).toString(),
  );
}
export function verifyStripe(
  raw: Buffer,
  signature: string,
  secret: string,
  now = Date.now(),
): boolean {
  const parts = signature.split(',');
  const t = parts.find((p) => p.startsWith('t='))?.slice(2);
  if (!t || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${t}.`)
    .update(raw)
    .digest();
  return parts
    .filter((p) => p.startsWith('v1='))
    .some((p) => {
      const got = Buffer.from(p.slice(3), 'hex');
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
}
