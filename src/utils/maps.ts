/**
 * We deliberately do not rate how safe a block is, or compute commute times
 * ourselves: the honest version of both is handing the address to a map
 * everyone already knows how to read.
 */
interface Place {
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
}

const TIME_ZONE = 'America/Los_Angeles';

function placeQuery(listing: Place): string {
  return listing.address.trim()
    ? `${listing.address}, San Francisco, CA`
    : listing.lat !== null && listing.lng !== null
      ? `${listing.lat},${listing.lng}`
      : `${listing.neighborhood}, San Francisco, CA`;
}

export function googleMapsUrl(listing: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(listing))}`;
}

/** "GMT-07:00" during daylight saving, "GMT-08:00" outside it. */
function sanFranciscoOffset(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  return parts.find((part) => part.type === 'timeZoneName')?.value.replace('GMT', '') || '-08:00';
}

function sanFranciscoDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** The next weekday at `time` in San Francisco, as a unix timestamp. */
export function nextWeekdayDeparture(time: string, now = new Date()): number {
  const [hours = 8, minutes = 0] = time.split(':').map(Number);
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  for (let ahead = 0; ahead < 8; ahead += 1) {
    const day = new Date(now.getTime() + ahead * 86_400_000);
    const stamp = Date.parse(`${sanFranciscoDate(day)}T${clock}:00${sanFranciscoOffset(day)}`);
    if (Number.isNaN(stamp) || stamp <= now.getTime()) continue;

    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(
      new Date(stamp),
    );
    if (weekday === 'Sat' || weekday === 'Sun') continue;
    return Math.round(stamp / 1000);
  }
  return Math.round(now.getTime() / 1000);
}

export type CommuteMode = 'transit' | 'drive';

/**
 * Google's documented Maps URLs cannot carry a departure time — it silently
 * falls back to "leave now" — so this uses the `data=` form the site itself
 * produces, where `8j<unix>` is the departure and `3e3`/`3e0` the travel mode.
 */
export function commuteUrl(
  listing: Place,
  destination: string,
  time: string,
  mode: CommuteMode,
  now = new Date(),
): string {
  const origin = encodeURIComponent(placeQuery(listing));
  const target = encodeURIComponent(destination.trim());
  const travel = mode === 'drive' ? '3e0' : '3e3';
  return `https://www.google.com/maps/dir/${origin}/${target}/data=!4m6!4m5!2m3!6e0!7e2!8j${nextWeekdayDeparture(time, now)}!${travel}`;
}

/** "8:00 AM" from "08:00", for labelling the link. */
export function clockLabel(time: string): string {
  const [hours = 8, minutes = 0] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
