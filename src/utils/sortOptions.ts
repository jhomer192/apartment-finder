import type { SortOption } from '../types';

/** Grouped so the money sorts, the location sorts and the risk sorts are separable at a glance. */
export const SORT_GROUPS: Array<{ label: string; options: Array<{ value: SortOption; label: string }> }> = [
  {
    label: 'Price',
    options: [
      { value: 'price-asc', label: 'Cheapest rent' },
      { value: 'ppbed', label: 'Cheapest per bedroom' },
      { value: 'ppsqft', label: 'Cheapest per sqft' },
      { value: 'price-desc', label: 'Priciest rent' },
    ],
  },
  { label: 'Size', options: [{ value: 'sqft-desc', label: 'Largest' }] },
  {
    label: 'Area',
    options: [
      { value: 'safety', label: 'Best area safety rating' },
      { value: 'incidents', label: 'Lowest incident rate per resident' },
      { value: 'transit', label: 'Closest to a train' },
    ],
  },
  {
    label: 'Scam risk',
    options: [
      { value: 'scam', label: 'Safest listings first' },
      { value: 'scam-desc', label: 'Riskiest listings first' },
    ],
  },
];

export function sortLabel(sort: SortOption): string {
  for (const group of SORT_GROUPS) {
    const hit = group.options.find((option) => option.value === sort);
    if (hit) return hit.label;
  }
  return sort;
}
