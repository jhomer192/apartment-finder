import type { SearchSource, SourceUrlParams } from '../types';

function bedsParam(beds: number | null): string {
  if (beds === null) return '';
  if (beds === 0) return 'studio';
  return `${beds}`;
}

export const SEARCH_SOURCES: SearchSource[] = [
  {
    id: 'zillow',
    name: 'Zillow',
    color: '#006AFF',
    description: 'Largest rental marketplace with 3D tours and detailed filters',
    buildUrl: ({ city, state, minRent, maxRent, bedrooms }: SourceUrlParams) => {
      const cityState = `${city}-${state}`.replace(/\s+/g, '-');
      const bedsPath = bedrooms !== null ? `${bedsParam(bedrooms)}-beds/` : '';
      const filterState = encodeURIComponent(JSON.stringify({
        fr: { value: true },
        fsba: { value: false },
        fsbo: { value: false },
        nc: { value: false },
        cmsn: { value: false },
        auc: { value: false },
        fore: { value: false },
        mp: { min: minRent, max: maxRent },
      }));
      return `https://www.zillow.com/${cityState}/rentals/${bedsPath}?searchQueryState=${filterState}`;
    },
  },
  {
    id: 'apartments',
    name: 'Apartments.com',
    color: '#6B46C1',
    description: 'Millions of listings with virtual tours and neighborhood guides',
    buildUrl: ({ citySlug, state, minRent, maxRent, bedrooms }: SourceUrlParams) => {
      const bedsPath = bedrooms !== null
        ? (bedrooms === 0 ? 'studios/' : `${bedrooms}-bedrooms/`)
        : '';
      return `https://www.apartments.com/${citySlug}-${state.toLowerCase()}/${bedsPath}?bb=&px=${minRent}-${maxRent}`;
    },
  },
  {
    id: 'craigslist',
    name: 'Craigslist',
    color: '#5C0E9F',
    description: 'Direct-from-owner listings, often with no broker fees',
    buildUrl: ({ region, minRent, maxRent, bedrooms }: SourceUrlParams) => {
      const bedsParam = bedrooms !== null ? `&min_bedrooms=${bedrooms}&max_bedrooms=${bedrooms}` : '';
      return `https://${region}.craigslist.org/search/apa?min_price=${minRent}&max_price=${maxRent}${bedsParam}`;
    },
  },
  {
    id: 'trulia',
    name: 'Trulia',
    color: '#54B946',
    description: 'Neighborhood insights, commute times, and crime maps',
    buildUrl: ({ city, state, bedrooms }: SourceUrlParams) => {
      const bedsPath = bedrooms !== null
        ? (bedrooms === 0 ? 'studio_beds/' : `${bedrooms}_beds/`)
        : '';
      return `https://www.trulia.com/for_rent/${city.replace(/\s+/g, '_')},${state}/${bedsPath}`;
    },
  },
  {
    id: 'redfin',
    name: 'Redfin',
    color: '#A02021',
    description: 'Accurate pricing data and real-time availability updates',
    buildUrl: ({ city, state }: SourceUrlParams) => {
      const cityPath = city.replace(/\s+/g, '-');
      return `https://www.redfin.com/city/${cityPath}/${state}/apartments-for-rent`;
    },
  },
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    color: '#1877F2',
    description: 'Peer-to-peer listings and local landlord rentals',
    buildUrl: ({ city, minRent, maxRent, bedrooms }: SourceUrlParams) => {
      const cityPath = city.toLowerCase().replace(/\s+/g, '-');
      const bedsParam = bedrooms !== null ? `&minBedrooms=${bedrooms}` : '';
      return `https://www.facebook.com/marketplace/${cityPath}/propertyrentals/?minPrice=${minRent}&maxPrice=${maxRent}${bedsParam}`;
    },
  },
  {
    id: 'hotpads',
    name: 'HotPads',
    color: '#4A7C59',
    description: 'Map-first search with detailed building reviews',
    buildUrl: ({ citySlug, state }: SourceUrlParams) => {
      return `https://hotpads.com/${citySlug}-${state.toLowerCase()}/apartments-for-rent`;
    },
  },
  {
    id: 'rent',
    name: 'Rent.com',
    color: '#FF6B35',
    description: 'Move-in specials and virtual tour listings',
    buildUrl: ({ citySlug, state }: SourceUrlParams) => {
      return `https://www.rent.com/${citySlug}-${state.toLowerCase()}/`;
    },
  },
  {
    id: 'padmapper',
    name: 'PadMapper',
    color: '#E8491D',
    description: 'Aggregated listings from multiple sources on one map',
    buildUrl: ({ citySlug, state }: SourceUrlParams) => {
      return `https://www.padmapper.com/apartments/${citySlug}-${state.toLowerCase()}`;
    },
  },
];
