import type { ApartmentSource, SearchParams, Listing } from '../types';
import { generateMockListings } from '../data/mockListings';

export class MockSource implements ApartmentSource {
  name = 'mock';
  private listingsCache: Map<string, Listing[]> = new Map();

  private getListings(metroIds: string[]): Listing[] {
    const key = metroIds.sort().join(',');
    if (!this.listingsCache.has(key)) {
      this.listingsCache.set(key, generateMockListings(metroIds));
    }
    return this.listingsCache.get(key)!;
  }

  async search(params: SearchParams): Promise<Listing[]> {
    const all = this.getListings(params.metros);
    return all.filter(listing => {
      if (listing.price < params.minRent || listing.price > params.maxRent) {
        return false;
      }
      if (params.bedrooms !== null && listing.bedrooms !== params.bedrooms) {
        return false;
      }
      return true;
    });
  }
}
