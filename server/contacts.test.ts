import { beforeEach, describe, expect, it } from 'vitest';
import { deleteContact, listContacts, logContact, updateContact } from './contacts.js';
import { db } from './db.js';
import type { ScoredListing } from './listings.js';
import { getSaved, save, setStatus } from './shortlist.js';

function listing(): ScoredListing {
  return {
    key: 'redfin:1',
    externalId: '1',
    city: 'San Francisco',
    area: null,
    sourceId: 'redfin',
    sourceName: 'Redfin',
    title: '2 Bedroom in the Mission',
    description: 'Nice place',
    price: 4200,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    address: '123 Valencia St',
    neighborhood: 'Mission',
    lat: 37.76,
    lng: -122.42,
    url: 'https://example.com/1',
    imageUrl: null,
    imageUrls: [],
    photoCount: 4,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
  };
}

beforeEach(() => {
  db.exec('DELETE FROM listing_contacts; DELETE FROM listing_notes; DELETE FROM saved_listings;');
});

describe('contact log', () => {
  it('is shared and attributed to whoever reached out', () => {
    logContact('redfin:1', 'jack@example.com', 'email', 'asked for Saturday');
    const [entry] = listContacts();
    expect(entry).toMatchObject({
      listingKey: 'redfin:1',
      email: 'jack@example.com',
      via: 'email',
      outcome: 'sent',
      note: 'asked for Saturday',
    });
  });

  it('moves a freshly saved listing to contacted but leaves later statuses alone', () => {
    save(listing(), 'jack@example.com');
    logContact('redfin:1', 'garrett@example.com', 'sms', '');
    expect(getSaved('redfin:1')?.status).toBe('contacted');

    setStatus('redfin:1', 'touring');
    logContact('redfin:1', 'justin@example.com', 'call', '');
    expect(getSaved('redfin:1')?.status).toBe('touring');
  });

  it('records what came back', () => {
    const { id } = logContact('redfin:1', 'jack@example.com', 'email', '');
    expect(updateContact(id, { outcome: 'replied' })?.outcome).toBe('replied');
    expect(updateContact(id, { note: 'tour Sat 2pm' })).toMatchObject({ outcome: 'replied', note: 'tour Sat 2pm' });
    expect(updateContact(999, { outcome: 'declined' })).toBeNull();
  });

  it('can be undone', () => {
    const { id } = logContact('redfin:1', 'jack@example.com', 'email', '');
    expect(deleteContact(id)).toBe(true);
    expect(deleteContact(id)).toBe(false);
    expect(listContacts()).toEqual([]);
  });

  it('undoing the only contact puts the saved listing back to saved', () => {
    save(listing(), 'jack@example.com');
    const first = logContact('redfin:1', 'jack@example.com', 'email', '');
    const second = logContact('redfin:1', 'garrett@example.com', 'sms', '');
    deleteContact(first.id);
    expect(getSaved('redfin:1')?.status).toBe('contacted');
    deleteContact(second.id);
    expect(getSaved('redfin:1')?.status).toBe('saved');
  });
});
