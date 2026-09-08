import { useState } from 'react';
import { requestTours } from '../api/client';
import type { ContactEntry, PlannedTour, TourRequestResult } from '../api/types';
import { useContacts } from '../hooks/useContacts';
import { useTours } from '../hooks/useTours';
import { smsHref } from '../utils/share';
import { tourDayLabel, tourTime, worthReordering } from '../utils/tours';

const WARNING_TEXT = {
  overlap: 'Overlaps the tour before it',
  tight: 'Tight — the trip from the last stop probably takes longer than the gap',
} as const;

const REQUEST_NOTE_PREFIX = 'Tour request';
const NO_REPLY_AFTER_MS = 24 * 60 * 60 * 1000;
const REPLY_NOTE_MARKER = '· reply from ';

type RequestState =
  | { kind: 'none' }
  | { kind: 'waiting'; entry: ContactEntry; stale: boolean }
  | { kind: 'replied'; entry: ContactEntry; reply: string | null }
  | { kind: 'confirmed'; entry: ContactEntry }
  | { kind: 'declined'; entry: ContactEntry }
  | { kind: 'no-reply'; entry: ContactEntry };

function requestState(entries: ContactEntry[] | undefined): RequestState {
  const entry = entries?.find((e) => e.note.startsWith(REQUEST_NOTE_PREFIX));
  if (!entry) return { kind: 'none' };
  switch (entry.outcome) {
    case 'tour-offered':
      return { kind: 'confirmed', entry };
    case 'replied': {
      const at = entry.note.indexOf(REPLY_NOTE_MARKER);
      return { kind: 'replied', entry, reply: at === -1 ? null : entry.note.slice(at + REPLY_NOTE_MARKER.length) };
    }
    case 'declined':
      return { kind: 'declined', entry };
    case 'no-reply':
      return { kind: 'no-reply', entry };
    default:
      return { kind: 'waiting', entry, stale: Date.now() - entry.contactedAt > NO_REPLY_AFTER_MS };
  }
}

const STATE_STYLE: Record<RequestState['kind'], { label: string; color: string }> = {
  none: { label: 'Not requested', color: 'var(--text-dim)' },
  waiting: { label: 'Requested · waiting', color: '#d97706' },
  replied: { label: 'They wrote back', color: '#2563eb' },
  confirmed: { label: 'Confirmed', color: '#16a34a' },
  declined: { label: 'Declined', color: '#ef4444' },
  'no-reply': { label: 'No reply', color: '#ef4444' },
};

/**
 * The day's bookings in order, with clashes called out and each lister's
 * reply tracked. Ordering is by straight-line distance because there is no
 * routing key here, so the plan says how far apart stops are and hands the
 * actual route to Google Maps rather than inventing drive times.
 */
export function TourSchedule({ groupSize = 1 }: { groupSize?: number }) {
  const { days, cancel } = useTours();
  const contacts = useContacts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Map<number, TourRequestResult>>(new Map());
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);

  if (days.length === 0) return null;

  const checkInbox = async () => {
    setChecking(true);
    const changed = await contacts.checkReplies();
    setChecked(changed === 0 ? 'Inbox checked · nothing new' : `${changed} new repl${changed === 1 ? 'y' : 'ies'}`);
    setChecking(false);
  };

  /** Emails what it can from the server; anything else becomes a tap-to-text or open-site handoff. */
  const request = async (tours: PlannedTour[]) => {
    const ids = tours.map((tour) => tour.id);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { results, contacts: next } = await requestTours(ids, groupSize);
      contacts.replace(next);
      setPending((current) => {
        const map = new Map(current);
        for (const result of results) {
          if (result.channel === 'sms' || result.channel === 'site') map.set(result.tourId, result);
          else map.delete(result.tourId);
        }
        return map;
      });
      const failed = results.filter((r) => r.channel === 'none');
      if (failed.length > 0) {
        setError(
          failed.length === results.length
            ? 'None of these listers publish an email or phone — use the listing page.'
            : `${failed.length} lister${failed.length === 1 ? ' has' : 's have'} no email or phone; use their listing page.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the requests');
    } finally {
      setBusy(false);
    }
  };

  /** The roommate has sent the text/form themselves; record it so nobody asks twice. */
  const markHandedOff = async (tour: PlannedTour, result: TourRequestResult) => {
    const via = result.channel === 'sms' ? 'sms' : 'site';
    await contacts.log(tour.listingKey, via, `${REQUEST_NOTE_PREFIX} for ${tourTime(tour.startsAt)} · ${via === 'sms' ? `texted ${result.phone}` : 'sent via the listing page'}`);
    setPending((current) => {
      const map = new Map(current);
      map.delete(tour.id);
      return map;
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
      {days.map((day) => {
        const reorder = worthReordering(day);
        const order = new Map(day.suggestedOrder.map((key, index) => [key, index + 1]));
        const unrequested = day.tours.filter((tour) => requestState(contacts.byListing.get(tour.listingKey)).kind === 'none');
        const confirmed = day.tours.filter((tour) => requestState(contacts.byListing.get(tour.listingKey)).kind === 'confirmed').length;

        return (
          <div key={day.date} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {tourDayLabel(day.date)}
              </p>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {day.tours.length} tour{day.tours.length === 1 ? '' : 's'} · {confirmed} confirmed · {day.bookedKm} km between
                stops ({day.travelSource === 'osrm' ? 'by road' : 'straight line'})
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {contacts.replyTracking && (
                  <button
                    type="button"
                    disabled={checking}
                    onClick={() => void checkInbox()}
                    className="text-xs underline disabled:opacity-60"
                    style={{ color: 'var(--text-dim)' }}
                    title="Replies to jack's inbox are matched to these tours automatically every few minutes"
                  >
                    {checking ? 'Checking inbox…' : checked ?? 'Check inbox now'}
                  </button>
                )}
                {unrequested.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void request(unrequested)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {busy ? 'Sending…' : `Request ${unrequested.length === day.tours.length ? 'all' : unrequested.length} tour${unrequested.length === 1 ? '' : 's'}`}
                  </button>
                )}
                {day.routeUrl && (
                  <a
                    href={day.routeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    Open the day in Google Maps
                  </a>
                )}
              </div>
            </div>

            {reorder && (
              <p
                className="text-xs rounded-lg px-2.5 py-1.5"
                style={{
                  backgroundColor: 'color-mix(in srgb, #8b5cf6 14%, transparent)',
                  color: '#8b5cf6',
                }}
              >
                Visiting in the order marked below covers {day.suggestedKm} km instead of {day.bookedKm} km. {day.travelSource === 'osrm'
                  ? 'Distances are road-routed estimates with parking time, not live traffic.'
                  : 'Distances are straight-line, not driving times — check the Maps link before moving anything.'}
              </p>
            )}

            <ol className="space-y-2">
              {day.tours.map((tour) => {
                const state = requestState(contacts.byListing.get(tour.listingKey));
                const style = STATE_STYLE[state.kind];
                const handoff = pending.get(tour.id);
                return (
                  <li key={tour.id} className="text-xs space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                        {tourTime(tour.startsAt)}
                      </span>
                      <span style={{ color: 'var(--text)' }}>{tour.listing.title}</span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {tour.listing.neighborhood}
                        {tour.travelKm !== null && ` · ${tour.travelKm} km from the last stop`}
                      </span>
                      {reorder && order.has(tour.listingKey) && (
                        <span style={{ color: '#8b5cf6' }}>suggested stop #{order.get(tour.listingKey)}</span>
                      )}
                      {tour.warning && <span style={{ color: '#ef4444' }}>{WARNING_TEXT[tour.warning]}</span>}
                      <button
                        onClick={() => void cancel(tour.id)}
                        className="ml-auto underline"
                        style={{ color: '#ef4444' }}
                      >
                        cancel
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pl-1">
                      <span className="font-semibold" style={{ color: style.color }}>
                        {style.label}
                        {state.kind === 'waiting' && state.stale && ' over a day'}
                      </span>
                      {state.kind !== 'none' && (
                        <span style={{ color: 'var(--text-dim)' }}>
                          {state.entry.email.split('@')[0]} {state.entry.via === 'email' ? 'emailed' : state.entry.via === 'sms' ? 'texted' : 'contacted'}{' '}
                          {new Date(state.entry.contactedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}

                      {handoff?.channel === 'sms' && handoff.phone && (
                        <a
                          href={smsHref(handoff.body, [handoff.phone])}
                          onClick={() => void markHandedOff(tour, handoff)}
                          className="font-semibold underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          Text {handoff.phone} (no email published)
                        </a>
                      )}
                      {handoff?.channel === 'site' && handoff.url && (
                        <a
                          href={handoff.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void markHandedOff(tour, handoff)}
                          className="font-semibold underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          Ask on the listing page (no email or phone published)
                        </a>
                      )}

                      {state.kind === 'none' && !handoff && (
                        <button type="button" disabled={busy} onClick={() => void request([tour])} className="underline" style={{ color: 'var(--accent)' }}>
                          request this one
                        </button>
                      )}
                      {state.kind === 'replied' && state.reply && (
                        <span className="basis-full pl-2 italic" style={{ color: 'var(--text-dim)' }}>
                          {state.reply}
                        </span>
                      )}
                      {(state.kind === 'waiting' || state.kind === 'no-reply' || state.kind === 'replied') && (
                        <>
                          <button type="button" onClick={() => void contacts.update(state.entry.id, { outcome: 'tour-offered' })} className="underline" style={{ color: '#16a34a' }}>
                            they confirmed
                          </button>
                          <button type="button" onClick={() => void contacts.update(state.entry.id, { outcome: 'declined' })} className="underline" style={{ color: '#ef4444' }}>
                            declined
                          </button>
                          {state.kind === 'waiting' && state.stale && (
                            <button type="button" onClick={() => void contacts.update(state.entry.id, { outcome: 'no-reply' })} className="underline" style={{ color: 'var(--text-dim)' }}>
                              mark no reply
                            </button>
                          )}
                          {tour.listing.contactPhone && (
                            <a
                              href={`tel:${tour.listing.contactPhone.replace(/[^+0-9]/g, '')}`}
                              className="underline"
                              style={{ color: 'var(--text-dim)' }}
                            >
                              call {tour.listing.contactPhone}
                            </a>
                          )}
                        </>
                      )}
                      {(state.kind === 'confirmed' || state.kind === 'declined') && (
                        <button type="button" onClick={() => void contacts.update(state.entry.id, { outcome: 'sent' })} className="underline" style={{ color: 'var(--text-dim)' }}>
                          undo
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
