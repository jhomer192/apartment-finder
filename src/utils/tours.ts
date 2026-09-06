import type { PlannedTour, TourDay } from '../api/types';

/** `2026-03-14` + `10:30` as typed into the date and time inputs. */
export function toEpoch(date: string, time: string): number | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}`).getTime();
  return Number.isNaN(at) ? null : at;
}

export function tourTime(startsAt: number): string {
  return new Date(startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function tourDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function toursFor(days: TourDay[], listingKey: string): PlannedTour[] {
  return days.flatMap((day) => day.tours.filter((tour) => tour.listingKey === listingKey));
}

/**
 * Straight-line ordering only: without a routing key the app has no real drive
 * times, so a saving is only worth showing when it is more than a rounding
 * error on the day's distance.
 */
export function worthReordering(day: TourDay): boolean {
  if (day.tours.length < 3) return false;
  if (day.suggestedOrder.join('|') === day.tours.map((tour) => tour.listingKey).join('|')) return false;
  return day.bookedKm - day.suggestedKm >= 0.5;
}
