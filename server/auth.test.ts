import { beforeEach, describe, expect, it } from 'vitest';
import { hasPassword, setPassword, verifyPassword } from './auth.js';
import { db } from './db.js';

const EMAIL = 'test@example.com';

beforeEach(() => {
  db.prepare('DELETE FROM passwords').run();
});

describe('password sign-in', () => {
  it('accepts the password it was given and rejects anything else', () => {
    setPassword(EMAIL, 'correct horse battery');
    expect(hasPassword(EMAIL)).toBe(true);
    expect(verifyPassword(EMAIL, 'correct horse battery')).toBe(true);
    expect(verifyPassword(EMAIL, 'correct horse batter')).toBe(false);
  });

  it('normalises the address so casing does not lock someone out', () => {
    setPassword('Test@Example.com', 'correct horse battery');
    expect(verifyPassword(EMAIL, 'correct horse battery')).toBe(true);
  });

  it('rejects an address that never set one', () => {
    expect(hasPassword(EMAIL)).toBe(false);
    expect(verifyPassword(EMAIL, 'anything at all')).toBe(false);
  });

  it('rejects an address that is no longer on the allowlist', () => {
    setPassword('stranger@example.com', 'correct horse battery');
    expect(verifyPassword('stranger@example.com', 'correct horse battery')).toBe(false);
  });

  it('replaces the previous password rather than keeping both', () => {
    setPassword(EMAIL, 'correct horse battery');
    setPassword(EMAIL, 'a different long one');
    expect(verifyPassword(EMAIL, 'correct horse battery')).toBe(false);
    expect(verifyPassword(EMAIL, 'a different long one')).toBe(true);
  });
});
