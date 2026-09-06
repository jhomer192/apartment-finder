import { describe, expect, it } from 'vitest';
import { clockLabel, commuteUrl, nextWeekdayDeparture } from './maps';

const listing = { address: '704 Bush St', neighborhood: 'Nob Hill', lat: 37.79, lng: -122.41 };

describe('nextWeekdayDeparture', () => {
  it('skips the weekend', () => {
    // Saturday 2026-09-05, 10:00 PDT.
    const saturday = new Date('2026-09-05T17:00:00Z');
    const stamp = nextWeekdayDeparture('08:00', saturday);
    expect(new Date(stamp * 1000).toISOString()).toBe('2026-09-07T15:00:00.000Z');
  });

  it('rolls past a departure that has already gone', () => {
    // Monday 2026-09-07, 09:00 PDT — 08:00 is behind us.
    const monday = new Date('2026-09-07T16:00:00Z');
    const stamp = nextWeekdayDeparture('08:00', monday);
    expect(new Date(stamp * 1000).toISOString()).toBe('2026-09-08T15:00:00.000Z');
  });
});

describe('commuteUrl', () => {
  it('carries the address, departure and travel mode', () => {
    const url = commuteUrl(listing, '415 Mission St', '08:30', 'transit', new Date('2026-09-05T17:00:00Z'));
    expect(url).toContain('/maps/dir/704%20Bush%20St%2C%20San%20Francisco%2C%20CA/415%20Mission%20St/');
    expect(url).toContain(`8j${nextWeekdayDeparture('08:30', new Date('2026-09-05T17:00:00Z'))}`);
    expect(url).toMatch(/!3e3$/);
  });

  it('switches to driving directions', () => {
    expect(commuteUrl(listing, '415 Mission St', '08:00', 'drive')).toMatch(/!3e0$/);
  });
});

describe('clockLabel', () => {
  it('reads as a clock', () => {
    expect(clockLabel('08:00')).toBe('8:00 AM');
    expect(clockLabel('17:45')).toBe('5:45 PM');
    expect(clockLabel('00:15')).toBe('12:15 AM');
  });
});
