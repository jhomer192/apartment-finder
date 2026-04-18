import type { FilterState, ScoredListing } from '../types';

interface Props {
  filters: FilterState;
  onToggleAmenity: (amenity: string) => void;
  onClear: () => void;
  listings: ScoredListing[];
}

const AMENITY_GROUPS = [
  {
    label: 'Laundry',
    amenities: ['In-unit laundry', 'Shared laundry'],
  },
  {
    label: 'Parking',
    amenities: ['Parking included', 'Garage parking'],
  },
  {
    label: 'Pets',
    amenities: ['Pet-friendly', 'Cats only', 'Dog run'],
  },
  {
    label: 'Fitness & Recreation',
    amenities: ['Gym', 'Pool', 'Rooftop deck'],
  },
  {
    label: 'Building',
    amenities: ['Doorman', 'Elevator', 'Concierge', 'Package lockers'],
  },
  {
    label: 'Unit Features',
    amenities: ['Balcony', 'Central AC', 'Hardwood floors', 'Dishwasher'],
  },
];

export function FilterSidebar({ filters, onToggleAmenity, onClear, listings }: Props) {
  function amenityCount(amenity: string): number {
    return listings.filter(l =>
      l.amenities.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
    ).length;
  }

  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text)' }}>Filters</h3>
        {filters.amenities.size > 0 && (
          <button
            onClick={onClear}
            className="text-xs transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-4">
        {AMENITY_GROUPS.map(group => (
          <div key={group.label}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-dim)' }}>{group.label}</h4>
            <div className="space-y-1">
              {group.amenities.map(amenity => {
                const count = amenityCount(amenity);
                const checked = filters.amenities.has(amenity);
                return (
                  <label
                    key={amenity}
                    className="flex items-center gap-2 text-sm cursor-pointer py-0.5"
                    style={{ color: 'var(--text)' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleAmenity(amenity)}
                      className="rounded w-3.5 h-3.5"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', accentColor: 'var(--accent)' }}
                    />
                    <span className="flex-1">{amenity}</span>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{count}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
