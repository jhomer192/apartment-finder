import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn<(message: { to: string; subject: string; text: string; replyTo?: string }) => Promise<void>>();
let configured = true;
vi.mock('./mailer.js', () => ({
  sendMail: (message: { to: string; subject: string; text: string; replyTo?: string }) => sendMail(message),
  mailConfigured: () => configured,
}));

import { listContacts, updateContact } from './contacts.js';
import { db } from './db.js';
import type { ScoredListing } from './scoring.js';
import { save } from './shortlist.js';
import { requestMessage, requestTours, sendReplyReminders, tourWhen, unansweredRequests } from './tour-requests.js';
import { bookTour, type Tour } from './tours.js';

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    key: 'redfin:abc',
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: 'abc',
    title: '3 Bedroom',
    description: '',
    price: 5400,
    bedrooms: 3,
    bathrooms: 2,
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

/** Contacts are stamped with the wall clock, so the test clock has to be the real one. */
const NOW = Date.now();
const SUNDAY = NOW + 4 * 24 * 60 * 60 * 1000;
const WHEN = tourWhen(SUNDAY);
const JACK = 'jack@example.com';

function book(l: ScoredListing): Tour {
  save(l, JACK);
  const tour = bookTour({ listingKey: l.key, startsAt: SUNDAY, minutes: 30, note: 'Planned tour day' }, JACK, NOW);
  if (!tour) throw new Error('not booked');
  return tour;
}

beforeEach(() => {
  db.exec('DELETE FROM tours; DELETE FROM listing_contacts; DELETE FROM saved_listings;');
  sendMail.mockReset();
  sendMail.mockResolvedValue();
  configured = true;
});

describe('requestMessage', () => {
  it('names the group, the address, the price and the Sunday slot, signed by the sender', () => {
    const { subject, body } = requestMessage(book(listing()), JACK, 3);
    expect(subject).toBe(`Tour request: 1234 Market St — ${WHEN}`);
    expect(body).toContain('We are a group of 3 roommates');
    expect(body).toContain('3-bedroom listing at 1234 Market St ($5,400/mo)');
    expect(body).toContain(WHEN);
    expect(body).toContain(`Jack (${JACK})`);
  });

  it('keeps poster text from breaking the subject header', () => {
    const { subject } = requestMessage(book(listing({ address: 'Nice\r\nBcc: victim@example.com' })), JACK, 1);
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain('Nice Bcc: victim@example.com');
  });
});

describe('requestTours', () => {
  it('emails a lister who publishes an address, reply-to the roommate, and logs it', async () => {
    const tour = book(listing({ contactEmail: 'leasing@example.com' }));
    const [result] = await requestTours([tour.id], JACK, 3, NOW);
    expect(result.channel).toBe('emailed');
    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe('leasing@example.com');
    expect(message.replyTo).toBe(JACK);
    expect(message.subject).toContain('Tour request');
    const [entry] = listContacts();
    expect(entry.via).toBe('email');
    expect(entry.outcome).toBe('sent');
    expect(entry.note).toBe(`Tour request for ${WHEN} · emailed leasing@example.com`);
  });

  it('refuses to ask the same lister twice in a day', async () => {
    const tour = book(listing({ contactEmail: 'leasing@example.com' }));
    await requestTours([tour.id], JACK, 3, NOW);
    const [again] = await requestTours([tour.id], 'garrett@example.com', 3, NOW + 60_000);
    expect(again.channel).toBe('already');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('never mails unsubscribe/no-reply mailboxes; falls back to the phone', async () => {
    const tour = book(listing({ contactEmail: 'no-reply@example.com', contactPhone: '(415) 555-0100' }));
    const [result] = await requestTours([tour.id], JACK, 3, NOW);
    expect(result.channel).toBe('sms');
    expect(result.phone).toBe('(415) 555-0100');
    expect(result.body).toContain(WHEN);
    expect(sendMail).not.toHaveBeenCalled();
    expect(listContacts()).toHaveLength(0);
  });

  it('hands off to the listing page when there is no email or phone', async () => {
    const tour = book(listing());
    const [result] = await requestTours([tour.id], JACK, 3, NOW);
    expect(result.channel).toBe('site');
    expect(result.url).toBe('https://redfin.example/abc');
  });

  it('hands off to SMS when mail is not configured on the server', async () => {
    configured = false;
    const tour = book(listing({ contactEmail: 'leasing@example.com', contactPhone: '415-555-0100' }));
    const [result] = await requestTours([tour.id], JACK, 3, NOW);
    expect(result.channel).toBe('sms');
  });

  it('reports a mail failure without leaking the transport error and does not log a contact', async () => {
    sendMail.mockRejectedValue(new Error('535 auth failed for smtp://user:pass@host'));
    const tour = book(listing({ contactEmail: 'leasing@example.com' }));
    const [result] = await requestTours([tour.id], JACK, 3, NOW);
    expect(result.channel).toBe('none');
    expect(result.error).not.toContain('smtp://');
    expect(listContacts()).toHaveLength(0);
  });

  it('skips tour ids that do not exist', async () => {
    expect(await requestTours([999], JACK, 3, NOW)).toEqual([]);
  });
});

describe('reminders', () => {
  it('lists requests still marked sent after a day, but not answered or past ones', async () => {
    const waiting = book(listing({ contactEmail: 'a@example.com' }));
    const answered = book(listing({ key: 'redfin:b', externalId: 'b', contactEmail: 'b@example.com' }));
    await requestTours([waiting.id, answered.id], JACK, 3, NOW);
    const answeredEntry = listContacts().find((entry) => entry.listingKey === 'redfin:b');
    updateContact(answeredEntry!.id, { outcome: 'tour-offered' });

    expect(unansweredRequests(JACK, NOW + 60 * 60 * 1000)).toEqual([]);
    const later = unansweredRequests(JACK, NOW + 25 * 60 * 60 * 1000);
    expect(later.map(({ tour }) => tour.id)).toEqual([waiting.id]);
    expect(unansweredRequests(JACK, SUNDAY + 1)).toEqual([]);
  });

  it('nudges the roommate once a day and lists the tour', async () => {
    const tour = book(listing({ contactEmail: 'a@example.com' }));
    await requestTours([tour.id], JACK, 3, NOW);
    sendMail.mockClear();

    const later = NOW + 25 * 60 * 60 * 1000;
    expect(await sendReplyReminders(later)).toBe(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe(JACK);
    expect(message.text).toContain('1234 Market St');
    expect(message.text).toContain(WHEN);
    expect(await sendReplyReminders(later + 60_000)).toBe(0);
  });
});
