import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 8 * 60 * 60 * 1000; // 8時間

function sign(payload) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
}

export function signToken() {
  const expiry = String(Date.now() + TTL_MS);
  return `${expiry}.${sign(expiry)}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;

  const expiry = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return false;

  const expected = sign(expiry);
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
