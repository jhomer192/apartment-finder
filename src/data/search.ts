import type { SearchParams } from '../types';

export const DEFAULT_SEARCH: SearchParams = {
  minRent: 1,
  maxRent: 40_000,
  minBedrooms: null,
  maxBedrooms: null,
  minBathrooms: null,
  maxBathrooms: null,
  dedupe: true,
};
