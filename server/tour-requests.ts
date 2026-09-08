import { config } from './config.js';
import { leasingEmail } from './contact-info.js';
import { listContacts, logContact, type ContactEntry } from './contacts.js';
import { db } from './db.js';
import { mailConfigured, sendMail } from './mailer.js';
import { listTours, type Tour } from './tours.js';

export const REQUEST_NOTE_PREFIX = 'Tour request';

/** Nobody wants the same landlord asked twice in a day by the same group. */
const REPEAT_WINDOW_MS = 20 * 60 * 60 * 1000;
/** How long an unanswered request sits before the reminder names it. */
export const NO_REPLY_AFTER_MS = 24 * 60 * 60 * 1000;

const TZ = 'America/Los_Angeles';

export type RequestChannel = 'emailed' | 'sms' | 'site' | 'none' | 'already';

export interface TourRequestResult {
  tourId: number;
  listingKey: string;
  channel: RequestChannel;
  /** Filled for `sms`: the client opens the phone's Messages app with this. */
  phone: string | null;
  body: string;
  /** Filled for `site`: the listing page, where the lister's own form lives. */
  url: string | null;
  error?: string;
}

export function tourWhen(startsAt: number): string {
  return new Date(startsAt).toLocaleString('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function senderName(email: string): string {
  const local = email.split('@')[0] ?? email;
  const word = local.split(/[._-]/)[0] ?? local;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Listing text is untrusted; it must never reach a mail header with a line break in it. */
function headerSafe(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').trim();
}

export function requestMessage(tour: Tour, sender: string, groupSize: number): { subject: string; body: string } {
  const { listing } = tour;
  const where = headerSafe(listing.address || listing.title);
  const when = tourWhen(tour.startsAt);
  const people = groupSize === 1 ? 'I am' : `We are a group of ${groupSize} roommates`;
  const subject = `Tour request: ${where} — ${when}`;
  const body = [
    'Hello,',
    '',
    `${people} interested in your ${listing.bedrooms ?? ''}${listing.bedrooms ? '-bedroom ' : ''}listing at ${where} ($${listing.price.toLocaleString()}/mo). Could we tour it on ${when}? If that slot is taken, any time that day works.`,
    '',
    'Could you also confirm it is still available, the earliest move-in date, the lease length, and the deposit?',
    '',
    `Thanks,`,
    `${senderName(sender)} (${sender})`,
  ].join('\n');
  return { subject, body };
}

function latestRequest(contacts: ContactEntry[], listingKey: string, since: number): ContactEntry | null {
  return (
    contacts.find(
      (entry) =>
        entry.listingKey === listingKey &&
        entry.note.startsWith(REQUEST_NOTE_PREFIX) &&
        entry.contactedAt >= since,
    ) ?? null
  );
}

/**
 * Asks each lister for the booked time. Only listings that publish an email
 * get mailed by the server; phone-only listers come back as an `sms` handoff
 * the roommate sends from their own phone, and form-only sites as a link.
 */
export async function requestTours(
  tourIds: number[],
  sender: string,
  groupSize: number,
  now = Date.now(),
): Promise<TourRequestResult[]> {
  const tours = new Map(listTours().map((tour) => [tour.id, tour]));
  const contacts = listContacts();
  const results: TourRequestResult[] = [];

  for (const id of tourIds) {
    const tour = tours.get(id);
    if (!tour) continue;
    const { listing } = tour;
    const { subject, body } = requestMessage(tour, sender, groupSize);
    const base = { tourId: id, listingKey: listing.key, phone: null, body, url: null };

    if (latestRequest(contacts, listing.key, now - REPEAT_WINDOW_MS)) {
      results.push({ ...base, channel: 'already' });
      continue;
    }

    const email = leasingEmail(listing.contactEmail);
    if (email && mailConfigured()) {
      try {
        await sendMail({
          to: email,
          cc: sender,
          replyTo: sender,
          subject: `[Apartment Finder] ${subject}`,
          text: body,
        });
        logContact(listing.key, sender, 'email', `${REQUEST_NOTE_PREFIX} for ${tourWhen(tour.startsAt)} · emailed ${email}`);
        results.push({ ...base, channel: 'emailed' });
      } catch (error) {
        console.error('tour request mail failed:', error instanceof Error ? error.message : error);
        results.push({ ...base, channel: 'none', error: 'The mail server refused the message; try again later.' });
      }
      continue;
    }

    if (listing.contactPhone) {
      results.push({ ...base, channel: 'sms', phone: listing.contactPhone });
      continue;
    }
    results.push({ ...base, channel: listing.url ? 'site' : 'none', url: listing.url || null });
  }
  return results;
}

/** Requests still marked `sent` after a day, for a roommate's tours that have not happened yet. */
export function unansweredRequests(sender: string, now = Date.now()): { tour: Tour; contact: ContactEntry }[] {
  const contacts = listContacts();
  return listTours()
    .filter((tour) => tour.startsAt > now)
    .flatMap((tour) => {
      const contact = contacts.find(
        (entry) =>
          entry.listingKey === tour.listingKey &&
          entry.email === sender &&
          entry.note.startsWith(REQUEST_NOTE_PREFIX) &&
          entry.outcome === 'sent' &&
          now - entry.contactedAt >= NO_REPLY_AFTER_MS,
      );
      return contact ? [{ tour, contact }] : [];
    });
}

const reminderSentAt = new Map<string, number>();

/** One nudge per roommate per day listing what nobody has answered yet. */
export async function sendReplyReminders(now = Date.now()): Promise<number> {
  if (!mailConfigured()) return 0;
  const senders = (db.prepare('SELECT DISTINCT created_by AS email FROM tours').all() as { email: string }[]).map(
    (row) => row.email,
  );
  let sent = 0;
  for (const sender of senders) {
    const last = reminderSentAt.get(sender) ?? 0;
    if (now - last < 23 * 60 * 60 * 1000) continue;
    const open = unansweredRequests(sender, now);
    if (open.length === 0) continue;

    const lines = open.map(({ tour, contact }) => {
      const where = tour.listing.address || tour.listing.title;
      return `• ${tourWhen(tour.startsAt)} — ${where} (${tour.listing.neighborhood}) · asked ${new Date(contact.contactedAt).toLocaleDateString('en-US', { timeZone: TZ })} via ${contact.via}`;
    });
    try {
      await sendMail({
        to: sender,
        subject: `${open.length} tour request${open.length === 1 ? '' : 's'} still waiting on a reply`,
        text: [
          'No reply logged yet for these upcoming tours:',
          '',
          ...lines,
          '',
          'If they did answer, mark the tour Confirmed or Declined in the Shortlist so the group knows.',
          'Otherwise this is a good moment to text or call — phone numbers are on each saved card.',
          config.publicUrl ? `\n${config.publicUrl}` : '',
        ].join('\n'),
      });
      reminderSentAt.set(sender, now);
      sent += 1;
    } catch (error) {
      console.error(`reply reminder to ${sender} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return sent;
}

export function startReminderLoop(): void {
  const tick = () => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()));
    if (hour !== 9 && hour !== 18) return;
    sendReplyReminders().catch((error) => {
      console.error('reply reminder failed:', error instanceof Error ? error.message : error);
    });
  };
  setInterval(tick, 30 * 60 * 1000).unref();
}
