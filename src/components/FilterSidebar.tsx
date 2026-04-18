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
  // Count how many listings have each amenity
  function amenityCount(amenity: string): number {
    return listings.filter(l =>
      l.amenities.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
    ).length;
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Filters</h3>
        {filters.amenities.size > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-4">
        {AMENITY_GROUPS.map(group => (
          <div key={group.label}>
            <h4 className="text-xs font-medium text-slate-400 mb-2">{group.label}</h4>
            <div className="space-y-1">
              {group.amenities.map(amenity => {
                const count = amenityCount(amenity);
                const checked = filters.amenities.has(amenity);
                return (
                  <label
                    key={amenity}
                    className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 cursor-pointer py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleAmenity(amenity)}
                      className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span className="flex-1">{amenity}</span>
                    <span className="text-xs text-slate-500">{count}</span>
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
