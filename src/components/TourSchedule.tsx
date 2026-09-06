import { useTours } from '../hooks/useTours';
import { tourDayLabel, tourTime, worthReordering } from '../utils/tours';

const WARNING_TEXT = {
  overlap: 'Overlaps the tour before it',
  tight: 'Tight — the trip from the last stop probably takes longer than the gap',
} as const;

/**
 * The day's bookings in order, with clashes called out. Ordering is by
 * straight-line distance because there is no routing key here, so the plan
 * says how far apart stops are and hands the actual route to Google Maps
 * rather than inventing drive times.
 */
export function TourSchedule() {
  const { days, cancel } = useTours();

  if (days.length === 0) return null;

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const reorder = worthReordering(day);
        const order = new Map(day.suggestedOrder.map((key, index) => [key, index + 1]));

        return (
          <div key={day.date} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {tourDayLabel(day.date)}
              </p>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {day.tours.length} tour{day.tours.length === 1 ? '' : 's'} · {day.bookedKm} km between stops
                (straight line)
              </span>
              {day.routeUrl && (
                <a
                  href={day.routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Open the day in Google Maps
                </a>
              )}
            </div>

            {reorder && (
              <p
                className="text-xs rounded-lg px-2.5 py-1.5"
                style={{
                  backgroundColor: 'color-mix(in srgb, #8b5cf6 14%, transparent)',
                  color: '#8b5cf6',
                }}
              >
                Visiting in the order marked below covers {day.suggestedKm} km instead of {day.bookedKm} km. Distances
                are straight-line, not driving times — check the Maps link before moving anything.
              </p>
            )}

            <ol className="space-y-1.5">
              {day.tours.map((tour) => (
                <li key={tour.id} className="flex flex-wrap items-baseline gap-2 text-xs">
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
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
