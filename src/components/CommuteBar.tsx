import { useState } from 'react';
import { useCommute } from '../hooks/useCommute';
import type { CommuteMode } from '../utils/maps';

/**
 * Sets the work address every listing links directions to. We do not estimate
 * the trip ourselves — the link hands the address, departure time and mode to
 * Google Maps, which is the only one of us with live transit and traffic data.
 */
export function CommuteBar() {
  const { commute, save } = useCommute();
  const [destination, setDestination] = useState(commute.destination);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border px-4 py-3"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...commute, destination });
      }}
    >
      <label className="flex-1 min-w-[220px] text-xs" style={{ color: 'var(--text-dim)' }}>
        Work address
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          onBlur={() => save({ ...commute, destination })}
          placeholder="e.g. 415 Mission St, San Francisco"
          maxLength={200}
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </label>

      <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Leaving at
        <input
          type="time"
          value={commute.time}
          onChange={(event) => save({ ...commute, time: event.target.value })}
          className="mt-1 block rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </label>

      <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
        By
        <select
          value={commute.mode}
          onChange={(event) => save({ ...commute, mode: event.target.value as CommuteMode })}
          className="mt-1 block rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="transit">Transit</option>
          <option value="drive">Driving</option>
        </select>
      </label>

      <p className="text-xs basis-full" style={{ color: 'var(--text-dim)' }}>
        {commute.destination.trim()
          ? 'Every listing now links to Google Maps directions for the next weekday at this time.'
          : 'Add an address to get a directions link on every listing. We never guess the travel time ourselves.'}
      </p>
    </form>
  );
}
