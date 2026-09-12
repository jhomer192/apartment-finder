import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
import { listContacts, updateContact, type ContactEntry } from './contacts.js';
import { db } from './db.js';
import { listSaved } from './shortlist.js';
import { listTours } from './tours.js';

/** Appended to the contact note so the schedule can show who wrote back and what they said. */
export const REPLY_NOTE_MARKER = '· reply from ';

const SNIPPET_CHARS = 160;
/** Only mail newer than this counts; older threads predate the requests. */
const LOOKBACK_MS = 21 * 24 * 60 * 60 * 1000;

export interface InboundMail {
  messageId: string;
  from: string;
  fromName: string;
  subject: string;
  text: string;
  receivedAt: number;
}

/**
 * Listing-site receipts ("You messaged 969 Fell St") quote the address but are
 * not the lister; so do our own outgoing copies.
 */
const RECEIPT_SENDERS = [
  /@info\.zumper\.com$/i,
  /@emp\.apartmentlist\.com$/i,
  /@zumper\.com$/i,
  /@apartmentlist\.com$/i,
  /@e\.rent\.com$/i,
  /@rent\.com$/i,
];
const RECEIPT_SUBJECTS = [/^you messaged /i, /^new listing recommendations/i, /^let's get you moving/i, /^still thinking about /i];

export function isReceipt(mail: InboundMail, ownAddresses: string[]): boolean {
  const from = mail.from.toLowerCase();
  if (ownAddresses.some((own) => own && from === own.toLowerCase())) return true;
  if (RECEIPT_SENDERS.some((re) => re.test(from))) return true;
  return RECEIPT_SUBJECTS.some((re) => re.test(mail.subject.trim()));
}

/**
 * A listing's address boiled down to house number + first street word, as a
 * pattern that tolerates unit numbers, ranges, and directionals in the mail.
 */
export function addressPattern(address: string): RegExp | null {
  const match = /^\s*(\d+)(?:\s*[-–]\s*\d+)?\s+(?:[NSEW]\.?\s+)?([A-Za-z0-9]+)/.exec(address);
  if (!match) return null;
  const [, number, street] = match;
  if (!number || !street || street.length < 2) return null;
  return new RegExp(`\\b${number}(?:\\s*[-–]\\s*\\d+)?\\s+(?:[NSEW]\\.?\\s+)?${escape(street)}\\b`, 'i');
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PendingRequest {
  contact: ContactEntry;
  address: string;
}

/** Contacts still waiting on a reply, with the address of the place they asked about. */
export function pendingRequests(): PendingRequest[] {
  const addresses = new Map<string, string>();
  for (const saved of listSaved()) addresses.set(saved.key, saved.listing.address || saved.listing.title);
  for (const tour of listTours()) addresses.set(tour.listingKey, tour.listing.address || tour.listing.title);
  return listContacts().flatMap((contact) => {
    if (contact.outcome !== 'sent') return [];
    const address = addresses.get(contact.listingKey);
    return address ? [{ contact, address }] : [];
  });
}

/** The waiting contact the mail is about, if its address is quoted in the subject or body. */
export function matchReply(mail: InboundMail, pending: PendingRequest[]): PendingRequest | null {
  const haystack = `${mail.subject}\n${mail.text}`.replace(/\s+/g, ' ');
  const hits = pending.filter(({ contact, address }) => {
    if (mail.receivedAt < contact.contactedAt - 60 * 60 * 1000) return false;
    const pattern = addressPattern(address);
    return pattern ? pattern.test(haystack) : false;
  });
  hits.sort((a, b) => b.contact.contactedAt - a.contact.contactedAt);
  return hits[0] ?? null;
}

export function snippet(text: string): string {
  const flat = text
    .replace(/\[https?:\/\/[^\]\s]+\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('>'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > SNIPPET_CHARS ? `${flat.slice(0, SNIPPET_CHARS - 1)}…` : flat;
}

function alreadySeen(messageId: string): boolean {
  return db.prepare('SELECT 1 FROM mail_seen WHERE message_id = ?').get(messageId) !== undefined;
}

function markSeen(messageId: string, now: number): void {
  db.prepare('INSERT OR IGNORE INTO mail_seen (message_id, seen_at) VALUES (?, ?)').run(messageId, now);
}

/**
 * Marks the matching request `replied` and records who wrote and what they
 * said. Returns the contacts that changed. Confirmation stays a human call:
 * an auto-responder is still a reply, not a booked tour.
 */
export function recordReplies(mails: InboundMail[], ownAddresses: string[], now = Date.now()): ContactEntry[] {
  const pending = pendingRequests();
  const changed: ContactEntry[] = [];
  for (const mail of mails) {
    if (!mail.messageId || alreadySeen(mail.messageId)) continue;
    markSeen(mail.messageId, now);
    if (isReceipt(mail, ownAddresses)) continue;
    const hit = matchReply(mail, pending);
    if (!hit) continue;
    const who = mail.fromName ? `${mail.fromName} <${mail.from}>` : mail.from;
    const when = new Date(mail.receivedAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
    const note = `${hit.contact.note} ${REPLY_NOTE_MARKER}${who} (${when}): ${snippet(mail.text) || mail.subject}`;
    const updated = updateContact(hit.contact.id, { outcome: 'replied', note: note.slice(0, 600) });
    if (updated) {
      changed.push(updated);
      pending.splice(pending.indexOf(hit), 1);
    }
  }
  return changed;
}

/** Everything that arrived since the oldest waiting request, oldest first. */
export async function fetchRecentMail(since: Date): Promise<InboundMail[]> {
  const imap = config.imap;
  if (!imap) return [];
  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: true,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
  });
  const mails: InboundMail[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const message of client.fetch({ since }, { source: true, internalDate: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        const sender = parsed.from?.value[0];
        mails.push({
          messageId: parsed.messageId ?? `uid:${message.uid}`,
          from: sender?.address ?? '',
          fromName: sender?.name ?? '',
          subject: parsed.subject ?? '',
          text: parsed.text ?? '',
          receivedAt: new Date(parsed.date ?? message.internalDate ?? Date.now()).getTime(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
  return mails;
}

export function replyTrackingConfigured(): boolean {
  return config.imap !== null;
}

export async function pollReplies(now = Date.now()): Promise<ContactEntry[]> {
  const pending = pendingRequests();
  if (pending.length === 0) return [];
  const oldest = Math.min(...pending.map(({ contact }) => contact.contactedAt));
  const since = new Date(Math.max(oldest - 60 * 60 * 1000, now - LOOKBACK_MS));
  const mails = await fetchRecentMail(since);
  const own = [config.imap?.user ?? '', config.smtp?.user ?? '', config.mailFrom.replace(/^.*<([^>]+)>.*$/, '$1')];
  return recordReplies(mails, own, now);
}

export function startReplyPolling(): void {
  if (!replyTrackingConfigured()) return;
  const tick = () => {
    pollReplies()
      .then((changed) => {
        for (const entry of changed) console.log(`lister replied about ${entry.listingKey}`);
      })
      .catch((error) => {
        console.error('reply poll failed:', error instanceof Error ? error.message : error);
      });
  };
  setTimeout(tick, 15_000).unref();
  setInterval(tick, config.replyPollMinutes * 60 * 1000).unref();
}
