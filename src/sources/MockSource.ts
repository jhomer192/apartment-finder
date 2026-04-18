import type { ApartmentSource, SearchParams, Listing } from '../types';
import { generateMockListings } from '../data/mockListings';

export class MockSource implements ApartmentSource {
  name = 'mock';
  private listings: Listing[] | null = null;

  private getListings(): Listing[] {
    if (!this.listings) {
      this.listings = generateMockListings();
    }
    return this.listings;
  }

  async search(params: SearchParams): Promise<Listing[]> {
    const all = this.getListings();
    return all.filter(listing => {
      if (listing.city.toLowerCase() !== params.city.toLowerCase()
          && !params.city.toLowerCase().includes('san francisco')
          && !params.city.toLowerCase().includes('sf')) {
        return false;
      }
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
