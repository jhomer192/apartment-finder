import { describe, expect, it } from 'vitest';

import { leasingEmail } from './contact-info.js';

describe('leasingEmail', () => {
  it('keeps a real leasing address', () => {
    expect(leasingEmail(' leasing@somaflats.com ')).toBe('leasing@somaflats.com');
  });

  it('drops opt-out and automated mailboxes', () => {
    for (const address of ['stop@rent.com', 'no-reply@rent.com', 'DoNotReply@example.com', 'unsubscribe@x.io']) {
      expect(leasingEmail(address)).toBeNull();
    }
  });

  it('treats blank and missing addresses as no contact', () => {
    expect(leasingEmail('  ')).toBeNull();
    expect(leasingEmail(null)).toBeNull();
  });
});
