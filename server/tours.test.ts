import { describe, expect, it } from 'vitest';
import type { ScoredListing } from './scoring.js';
import { kmBetween, planDays, sfDay, travelMinutes, type Tour } from './tours.js';

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    key: 'redfin:abc',
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: 'abc',
    title: '2 Bedroom',
    description: '',
    price: 4200,
    bedrooms: 2,
    bathrooms: null,
    sqft: null,
    address: '1234 Market St',
    city: 'San Francisco',
    lat: 37.76,
    lng: -122.42,
    url: 'https://redfin.example/abc',
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    neighborhood: 'Mission District',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
    ...overrides,
  } as ScoredListing;
}

/** 2026-03-14, in San Francisco time. */
function at(hour: number, minute = 0): number {
  return Date.parse(`2026-03-14T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-07:00`);
}

function tour(id: number, hour: number, place: Partial<ScoredListing>, minutes = 30): Tour {
  return {
    id,
    listingKey: `key-${id}`,
    startsAt: at(hour),
    minutes,
    note: '',
    createdBy: 'jack@example.com',
    listing: listing({ key: `key-${id}`, ...place }),
  };
}

const mission = { lat: 37.7599, lng: -122.4148, address: '3200 22nd St' };
const sunset = { lat: 37.7532, lng: -122.4842, address: '1400 Noriega St' };
const nobHill = { lat: 37.7929, lng: -122.4161, address: '1000 Jones St' };

describe('planDays', () => {
  it('groups by San Francisco day and orders by time', () => {
    const days = planDays([
      tour(2, 11, mission),
      tour(1, 9, nobHill),
      { ...tour(3, 9, sunset), startsAt: at(9) + 86_400_000 },
    ]);

    expect(days.map((day) => day.date)).toEqual(['2026-03-14', '2026-03-15']);
    expect(days[0].tours.map((booked) => booked.id)).toEqual([1, 2]);
  });

  it('flags a tour that starts before the previous one ends', () => {
    const days = planDays([tour(1, 10, mission, 60), tour(2, 10, nobHill)]);

    expect(days[0].tours[1].warning).toBe('overlap');
  });

  it('flags back-to-back tours across town as tight, not the ones with room', () => {
    const tight = planDays([tour(1, 10, sunset, 30), { ...tour(2, 10, mission), startsAt: at(10, 35) }]);
    expect(tight[0].tours[1].warning).toBe('tight');
    expect(tight[0].tours[1].travelKm).toBeGreaterThan(5);

    const roomy = planDays([tour(1, 10, sunset, 30), tour(2, 13, mission)]);
    expect(roomy[0].tours[1].warning).toBeNull();
  });

  it('does not warn about the first tour of the day', () => {
    const [day] = planDays([tour(1, 10, mission)]);

    expect(day.tours[0]).toMatchObject({ warning: null, travelKm: null, travelMinutes: null });
  });

  it('suggests the order that drives least', () => {
    // Booked Mission → Sunset → Nob Hill, which crosses the city twice.
    const [day] = planDays([tour(1, 9, mission), tour(2, 11, sunset), tour(3, 13, nobHill)]);

    expect(day.suggestedKm).toBeLessThan(day.bookedKm);
    expect(day.suggestedOrder).toEqual(['key-2', 'key-1', 'key-3']);
    expect(day.routeUrl).toContain('waypoints=3200+22nd+St');
  });

  it('leaves the booked order alone when nothing is known about where a listing is', () => {
    const [day] = planDays([
      tour(1, 9, mission),
      tour(2, 11, { lat: null, lng: null, address: '' }),
      tour(3, 13, nobHill),
    ]);

    expect(day.suggestedOrder).toEqual(['key-1', 'key-2', 'key-3']);
  });

  it('gives no route link for a single stop', () => {
    expect(planDays([tour(1, 9, mission)])[0].routeUrl).toBeNull();
  });
});

describe('distance estimates', () => {
  it('measures straight-line kilometres between two points', () => {
    expect(kmBetween(mission, nobHill)).toBeCloseTo(3.7, 0);
    expect(kmBetween({ lat: null, lng: null }, nobHill)).toBeNull();
  });

  it('adds parking time to the drive', () => {
    expect(travelMinutes(0)).toBe(5);
    expect(travelMinutes(6)).toBe(25);
  });

  it('reads a late-evening tour as that day in San Francisco, not the next in UTC', () => {
    expect(sfDay(at(21))).toBe('2026-03-14');
  });
});
