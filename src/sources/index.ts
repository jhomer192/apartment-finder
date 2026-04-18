import type { ApartmentSource, SearchParams, Listing } from '../types';
import { MockSource } from './MockSource';

export { MockSource };

const registeredSources: ApartmentSource[] = [new MockSource()];

export function registerSource(source: ApartmentSource): void {
  registeredSources.push(source);
}

export async function searchAllSources(params: SearchParams): Promise<Listing[]> {
  const results = await Promise.all(
    registeredSources.map(source => source.search(params))
  );
  return results.flat();
}
