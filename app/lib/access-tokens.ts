import { createHash, randomBytes } from 'node:crypto';

// The private token in Checkout Attempt and Booking links. Only its hash is stored.
export function generateAccessToken() {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string, hash: string) {
  return hashAccessToken(token) === hash;
}
