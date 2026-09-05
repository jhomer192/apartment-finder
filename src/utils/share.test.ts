import { describe, expect, it } from 'vitest';
import { listShareText, listingShareText, mailtoHref, shareSubject, smsHref, type Shareable } from './share';

function listing(overrides: Partial<Shareable> = {}): Shareable {
  return {
    title: 'Sunny 2 bed in the Mission',
    price: 4200,
    bedrooms: 2,
    bathrooms: 1,
    address: '1234 Valencia St #5',
    neighborhood: 'Mission',
    sourceName: 'Redfin',
    url: 'https://redfin.com/1',
    scam: { score: 12, band: 'low' },
    ...overrides,
  };
}

describe('sharing a listing', () => {
  it('names the site and links it, so the reader can open it without an account here', () => {
    expect(listingShareText(listing())).toBe(
      [
        'Sunny 2 bed in the Mission',
        '$4,200/mo · 2 bd / 1 ba · Mission',
        '1234 Valencia St #5',
        'Scam risk 12/100 (low)',
        'Redfin: https://redfin.com/1',
      ].join('\n'),
    );
  });

  it('carries the other sites advertising the same unit', () => {
    const text = listingShareText(listing({ alsoOn: [{ sourceName: 'Zumper', url: 'https://zumper.com/1' }] }));

    expect(text).toContain('Also on Zumper: https://zumper.com/1');
  });

  it('leaves out an address the source withheld rather than printing a blank line', () => {
    expect(listingShareText(listing({ address: '  ' }))).not.toContain('\n\n');
  });

  it('says Studio and drops unknown baths', () => {
    expect(listingShareText(listing({ bedrooms: 0, bathrooms: null }))).toContain('$4,200/mo · Studio · Mission');
  });

  it('separates apartments in a shared list with a blank line', () => {
    const text = listShareText([listing(), listing({ title: 'Second place' })]);

    expect(text.split('\n\n')).toHaveLength(2);
    expect(shareSubject([listing(), listing()])).toBe('2 apartments in San Francisco');
  });

  it('builds text and email links the phone will accept', () => {
    expect(smsHref('a b')).toBe('sms:?&body=a%20b');
    expect(mailtoHref('Sub ject', 'a b')).toBe('mailto:?subject=Sub%20ject&body=a%20b');
  });
});
