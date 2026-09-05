/**
 * Sharing is plain text on purpose: it has to survive being pasted into a text
 * message, an email or a group chat, and whoever receives it has no account
 * here — so every apartment carries the site it came from and that site's link.
 */
export interface Shareable {
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  address: string;
  neighborhood: string;
  sourceName: string;
  url: string;
  scam: { score: number; band: string };
  alsoOn?: { sourceName: string; url: string }[];
}

function rooms(listing: Shareable): string {
  const beds = listing.bedrooms === 0 ? 'Studio' : listing.bedrooms === null ? '? bd' : `${listing.bedrooms} bd`;
  return listing.bathrooms === null ? beds : `${beds} / ${listing.bathrooms} ba`;
}

export function listingShareText(listing: Shareable): string {
  const lines = [
    listing.title,
    `$${listing.price.toLocaleString()}/mo · ${rooms(listing)} · ${listing.neighborhood}`,
  ];
  if (listing.address.trim()) lines.push(listing.address);
  lines.push(`Scam risk ${listing.scam.score}/100 (${listing.scam.band})`);
  lines.push(`${listing.sourceName}: ${listing.url}`);
  for (const other of listing.alsoOn ?? []) lines.push(`Also on ${other.sourceName}: ${other.url}`);
  return lines.join('\n');
}

export function listShareText(listings: Shareable[]): string {
  return listings.map(listingShareText).join('\n\n');
}

export function shareSubject(listings: Shareable[]): string {
  if (listings.length === 1) {
    return `${listings[0].title} — $${listings[0].price.toLocaleString()}/mo`;
  }
  return `${listings.length} apartments in San Francisco`;
}

/**
 * `sms:` needs `&body=` after a `?` on iOS and `?body=` on Android; the `?&`
 * form is the one both accept.
 */
export function smsHref(body: string, phones: string[] = []): string {
  return `sms:${phones.map((phone) => phone.replace(/[^+0-9]/g, '')).filter(Boolean).join(',')}?&body=${encodeURIComponent(body)}`;
}

export function mailtoHref(subject: string, body: string, emails: string[] = []): string {
  return `mailto:${emails.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** A group is only textable/emailable through the people who gave that detail. */
export function reachable(members: { email: string; phone: string }[]) {
  return {
    emails: members.map((member) => member.email).filter(Boolean),
    phones: members.map((member) => member.phone).filter(Boolean),
  };
}

export function canShareNatively(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Resolves false when the phone's share sheet is dismissed, so nothing claims success. */
export async function shareNatively(title: string, text: string): Promise<boolean> {
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
