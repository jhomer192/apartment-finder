import { beforeEach, describe, expect, it } from 'vitest';
import { listContacts, logContact } from './contacts.js';
import { db } from './db.js';
import type { ScoredListing } from './listings.js';
import { addressPattern, isReceipt, recordReplies, snippet, type InboundMail } from './replies.js';
import { save } from './shortlist.js';

function listing(key: string, address: string): ScoredListing {
  return {
    key,
    externalId: key,
    city: 'San Francisco',
    area: null,
    sourceId: 'zumper',
    sourceName: 'Zumper',
    title: address,
    description: '',
    price: 7645,
    bedrooms: 5,
    bathrooms: 2,
    sqft: null,
    address,
    neighborhood: 'Hayes Valley',
    lat: 37.77,
    lng: -122.43,
    url: 'https://example.com/x',
    imageUrl: null,
    imageUrls: [],
    photoCount: 8,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
  };
}

const OWN = ['jack@example.com', 'finder@example.com'];
const SENT_AT = Date.parse('2026-09-05T18:00:00Z');

function mail(overrides: Partial<InboundMail>): InboundMail {
  return {
    messageId: '<m1@lister>',
    from: 'leasing@epicrealestate.example',
    fromName: 'Epic Leasing',
    subject: 'Re: Tour request for 969 Fell St',
    text: 'Sunday at 11 works, see you then.',
    receivedAt: SENT_AT + 3600_000,
    ...overrides,
  };
}

beforeEach(() => {
  db.exec('DELETE FROM listing_contacts; DELETE FROM listing_notes; DELETE FROM saved_listings; DELETE FROM mail_seen;');
  save(listing('zumper:1', '969 Fell St, San Francisco, CA 94117'), 'jack@example.com');
  save(listing('al:2', '1883 9th Ave'), 'jack@example.com');
  db.prepare('UPDATE listing_contacts SET contacted_at = ?').run(SENT_AT);
});

function request(key: string): number {
  const entry = logContact(key, 'jack@example.com', 'email', 'Tour request for Sun, Sep 13, 11:00 AM · sent via Zumper');
  db.prepare('UPDATE listing_contacts SET contacted_at = ? WHERE id = ?').run(SENT_AT, entry.id);
  return entry.id;
}

describe('address matching', () => {
  it('finds the house number and street through unit numbers and ranges', () => {
    const fell = addressPattern('969 Fell St, San Francisco')!;
    expect(fell.test('re: 969 Fell Street tour')).toBe(true);
    expect(fell.test('969-971 Fell St')).toBe(true);
    expect(fell.test('1969 Fell St')).toBe(false);
    expect(fell.test('969 Hayes St')).toBe(false);
    expect(addressPattern('Charming Victorian')).toBeNull();
  });
});

describe('receipts', () => {
  it('ignores listing-site receipts and our own copies', () => {
    expect(isReceipt(mail({ from: 'no-reply@info.zumper.com' }), OWN)).toBe(true);
    expect(isReceipt(mail({ from: 'hello@emp.apartmentlist.com' }), OWN)).toBe(true);
    expect(isReceipt(mail({ from: 'Finder@example.com' }), OWN)).toBe(true);
    expect(isReceipt(mail({ subject: 'You messaged 969 Fell St' }), OWN)).toBe(true);
    expect(isReceipt(mail({}), OWN)).toBe(false);
  });
});

describe('recording replies', () => {
  it('marks the matching request replied with who wrote and what they said', () => {
    const id = request('zumper:1');
    request('al:2');

    const changed = recordReplies([mail({})], OWN, SENT_AT + 7200_000);
    expect(changed.map((c) => c.id)).toEqual([id]);
    const entry = listContacts().find((c) => c.id === id)!;
    expect(entry.outcome).toBe('replied');
    expect(entry.note).toContain('Tour request for Sun, Sep 13');
    expect(entry.note).toContain('· reply from Epic Leasing <leasing@epicrealestate.example>');
    expect(entry.note).toContain('Sunday at 11 works');
    expect(listContacts().find((c) => c.listingKey === 'al:2')?.outcome).toBe('sent');
  });

  it('never processes the same message twice or touches receipts', () => {
    const id = request('zumper:1');
    recordReplies([mail({ from: 'no-reply@info.zumper.com' })], OWN);
    expect(listContacts().find((c) => c.id === id)?.outcome).toBe('sent');

    recordReplies([mail({})], OWN);
    const after = listContacts().find((c) => c.id === id)!;
    recordReplies([mail({ text: 'Actually, cancelled.' })], OWN);
    expect(listContacts().find((c) => c.id === id)).toEqual(after);
  });

  it('ignores mail that predates the request and mail about other places', () => {
    const id = request('zumper:1');
    recordReplies(
      [mail({ receivedAt: SENT_AT - 86_400_000 }), mail({ messageId: '<m2>', subject: 'Re: 1230 19th Ave', text: 'come by' })],
      OWN,
    );
    expect(listContacts().find((c) => c.id === id)?.outcome).toBe('sent');
  });

  it('does not treat a reply as a confirmed tour', () => {
    const id = request('zumper:1');
    recordReplies([mail({ text: 'Sorry, it was just rented.' })], OWN);
    expect(listContacts().find((c) => c.id === id)?.outcome).toBe('replied');
  });
});

describe('snippet', () => {
  it('drops quoted text and caps the length', () => {
    expect(snippet('Sure!\n\n> On Sat, Jack wrote:\n> could we tour')).toBe('Sure!');
    expect(snippet('x'.repeat(400))).toHaveLength(160);
  });
});
