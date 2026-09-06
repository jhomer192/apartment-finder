import type { SearchParams } from '../types';

export const DEFAULT_SEARCH: SearchParams = {
  minRent: 1500,
  maxRent: 6000,
  minBedrooms: null,
  maxBedrooms: null,
  minBathrooms: null,
  maxBathrooms: null,
  dedupe: true,
};
