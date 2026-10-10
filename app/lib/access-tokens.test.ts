import { describe, expect, it } from 'vitest';

import { generateAccessToken, hashAccessToken, verifyAccessToken } from './access-tokens';

describe('access tokens', () => {
  it('hashes and verifies access tokens', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);

    expect(token).toHaveLength(43);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAccessToken(token, hash)).toBe(true);
    expect(verifyAccessToken('wrong-token', hash)).toBe(false);
  });
});
