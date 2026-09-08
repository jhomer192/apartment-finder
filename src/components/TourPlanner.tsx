import { useState } from 'react';
import { bookTourPlan, planTourDay } from '../api/client';
import type { TourPlan } from '../api/types';
import { getMetroById } from '../data/metros';
import { useShortlist } from '../hooks/useShortlist';
import { useTours } from '../hooks/useTours';
import { toEpoch, tourDayLabel, tourTime } from '../utils/tours';

const NEIGHBORHOODS = (getMetroById('bay-area')?.neighborhoods ?? []).map((hood) => hood.name);

const inputStyle = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};
const input = 'rounded-lg px-2 py-1.5 text-sm border outline-none';

/**
 * The next Sunday listers can realistically confirm for, as YYYY-MM-DD in the
 * browser's zone: a Sunday under two days out is skipped for the one after.
 */
function nextSunday(from = new Date()): string {
  const date = new Date(from);
  let ahead = (7 - date.getDay()) % 7 || 7;
  if (ahead < 2) ahead += 7;
  date.setDate(date.getDate() + ahead);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Fills one day with the most tours that fit, picked from the cheapest listings
 * with enough bedrooms for the group in the neighborhoods they want. Legs are
 * straight-line estimates, so the plan links out to Google Maps for the drive.
 */
interface PlannerProps {
  groupSize: number;
  onGroupSize: (size: number) => void;
  onClose: () => void;
}

export function TourPlanner({ groupSize, onGroupSize, onClose }: PlannerProps) {
  const { reload } = useShortlist();
  const tours = useTours();

  const [date, setDate] = useState(nextSunday);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('17:00');
  const [tourMinutes, setTourMinutes] = useState(30);
  const [maxPerPerson, setMaxPerPerson] = useState('2000');
  const [leavingFrom, setLeavingFrom] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<number | null>(null);

  const toggleHood = (name: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const run = async () => {
    const startsAt = toEpoch(date, start);
    const endsAt = toEpoch(date, end);
    if (startsAt === null || endsAt === null || endsAt <= startsAt) {
      setError('Pick a day and a start time before the end time.');
      return;
    }
    setBusy(true);
    setError(null);
    setBooked(null);
    try {
      const perPerson = Number(maxPerPerson);
      setPlan(
        await planTourDay({
          startsAt,
          endsAt,
          tourMinutes,
          groupSize,
          maxPerPerson: Number.isFinite(perPerson) && perPerson > 0 ? Math.round(perPerson) : null,
          neighborhoods: [...picked],
          maxScamScore: 25,
          leavingFrom: leavingFrom || null,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not plan the day');
    } finally {
      setBusy(false);
    }
  };

  const bookAll = async () => {
    if (!plan || plan.stops.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bookTourPlan(
        plan.stops.map((stop) => ({ listingKey: stop.listing.key, startsAt: stop.startsAt })),
        tourMinutes,
      );
      tours.replace(result.days);
      reload();
      setBooked(result.booked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book the tours');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--accent)' }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Plan a tour day
          </p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Fits as many tours as the day holds, cheapest places first, routed as one sweep across the city with real drive
            times between stops.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs underline" style={{ color: 'var(--text-dim)' }}>
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          Day
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} w-full`} style={inputStyle} />
        </label>
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${input} w-full`} style={inputStyle} />
        </label>
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          Done by
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${input} w-full`} style={inputStyle} />
        </label>
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          People moving in
          <select value={groupSize} onChange={(e) => onGroupSize(Number(e.target.value))} className={`${input} w-full`} style={inputStyle}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'person' : 'people'} · {n}+ bd
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          Max $/person/mo
          <input
            type="number"
            min={0}
            step={50}
            value={maxPerPerson}
            onChange={(e) => setMaxPerPerson(e.target.value)}
            placeholder="No cap"
            className={`${input} w-full`}
            style={inputStyle}
          />
        </label>
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          Leaving from
          <select value={leavingFrom} onChange={(e) => setLeavingFrom(e.target.value)} className={`${input} w-full`} style={inputStyle}>
            <option value="">Anywhere (best route)</option>
            {NEIGHBORHOODS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1" style={{ color: 'var(--text-dim)' }}>
          Minutes per tour
          <select value={tourMinutes} onChange={(e) => setTourMinutes(Number(e.target.value))} className={`${input} w-full`} style={inputStyle}>
            {[15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Neighborhoods {picked.size === 0 ? '(any the house rules allow)' : `(${picked.size} picked)`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {NEIGHBORHOODS.map((name) => {
            const on = picked.has(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleHood(name)}
                aria-pressed={on}
                className="text-xs px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: on ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: on ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text-dim)',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {busy ? 'Planning…' : 'Plan the day'}
        </button>
        {error && (
          <span className="text-xs" style={{ color: '#ef4444' }}>
            {error}
          </span>
        )}
      </div>

      {plan && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {plan.stops.length === 0
              ? `Nothing fits: ${plan.candidates} listings match, but none can be toured in that window.`
              : `${plan.stops.length} tours on ${tourDayLabel(date)}${plan.start ? ` from ${plan.start.label}` : ''} · ${plan.totalKm} km / ~${plan.totalDriveMinutes} min driving in total · avg $${plan.averagePerPerson?.toLocaleString()}/person · ${plan.leftOver} more matched but did not fit`}
          </p>
          {plan.stops.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {plan.travelSource === 'osrm'
                ? 'Drive times are road-routed (OSRM) plus 15% and 5 min to park; ask each lister for the time shown.'
                : 'Routing was unreachable, so drive times are straight-line estimates — leave extra slack.'}
            </p>
          )}

          <ol className="space-y-1.5">
            {plan.stops.map((stop, index) => (
              <li key={stop.listing.key} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                  {index + 1}. {tourTime(stop.startsAt)}
                </span>
                <a
                  href={stop.listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: 'var(--text)' }}
                >
                  {stop.listing.title}
                </a>
                <span style={{ color: 'var(--text-dim)' }}>
                  {stop.listing.neighborhood} · {stop.listing.bedrooms} bd · ${stop.listing.price.toLocaleString()} (${stop.perPerson.toLocaleString()}/person)
                  {stop.saved && ' · saved'}
                </span>
                <span className="basis-full pl-4" style={{ color: 'var(--text-dim)' }}>
                  Ask for {tourTime(stop.startsAt)}
                  {stop.travelKm !== null
                    ? ` · ${stop.travelKm} km, ~${stop.travelMinutes} min from ${index === 0 ? plan.start?.label ?? 'the start' : 'the previous stop'}`
                    : ' · first stop of the day'}
                </span>
              </li>
            ))}
          </ol>

          {plan.stops.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void bookAll()}
                disabled={busy || booked !== null}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border disabled:opacity-60"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {booked !== null ? `Booked ${booked} tours` : `Save & book all ${plan.stops.length}`}
              </button>
              {plan.routeUrl && (
                <a
                  href={plan.routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Open the route in Google Maps{plan.stops.length > 10 ? ' (first 10 stops)' : ''}
                </a>
              )}
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {booked !== null
                  ? 'Booked — now hit "Request all tours" on the schedule below to ask each lister for the time.'
                  : 'Booking holds the slots for the group; the schedule below then asks each lister for you.'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
