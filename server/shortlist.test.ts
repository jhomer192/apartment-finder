import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import type { ScoredListing } from './listings.js';
import { addNote, getSaved, listSaved, save, setStatus, unsave } from './shortlist.js';

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    key: 'redfin:1',
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
    scam: { score: 5, band: 'low', reasons: [] },
    ...overrides,
  } as ScoredListing;
}

beforeEach(() => {
  db.exec('DELETE FROM listing_notes; DELETE FROM saved_listings;');
});

describe('shortlist', () => {
  it('is shared: anyone signed in sees what anyone else saved', () => {
    save(listing(), 'jack@example.com');
    const [entry] = listSaved();
    expect(entry.savedBy).toBe('jack@example.com');
    expect(entry.listing.title).toBe('2 Bedroom in the Mission');
    expect(entry.status).toBe('saved');
  });

  it('keeps the original saver and status when the listing is re-saved', () => {
    save(listing(), 'jack@example.com');
    setStatus('redfin:1', 'touring');
    save(listing({ price: 4000 }), 'garrett@example.com');

    const entry = getSaved('redfin:1');
    expect(entry?.savedBy).toBe('jack@example.com');
    expect(entry?.status).toBe('touring');
    expect(entry?.listing.price).toBe(4000);
  });

  it('serves the snapshot after the source drops the listing', () => {
    save(listing(), 'jack@example.com');
    expect(getSaved('redfin:1')?.listing.url).toBe('https://example.com/1');
  });

  it('attributes notes and returns them in order', () => {
    save(listing(), 'jack@example.com');
    addNote('redfin:1', 'jack@example.com', 'Walked past, block is fine');
    addNote('redfin:1', 'austin@example.com', 'Landlord replied');

    const notes = getSaved('redfin:1')?.notes ?? [];
    expect(notes.map((note) => note.email)).toEqual(['jack@example.com', 'austin@example.com']);
    expect(notes[1].body).toBe('Landlord replied');
  });

  it('refuses notes on a listing nobody saved', () => {
    expect(addNote('redfin:missing', 'jack@example.com', 'hi')).toBeNull();
  });

  it('removes notes along with the listing', () => {
    save(listing(), 'jack@example.com');
    addNote('redfin:1', 'jack@example.com', 'note');
    expect(unsave('redfin:1')).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM listing_notes').get()).toEqual({ n: 0 });
  });

  it('reports a miss rather than inventing an entry', () => {
    expect(unsave('redfin:missing')).toBe(false);
    expect(setStatus('redfin:missing', 'passed')).toBeNull();
  });
});
