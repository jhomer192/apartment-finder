import type { Listing, MergedListing } from '../types';

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\bst\b\.?/g, 'street')
    .replace(/\bave\b\.?/g, 'avenue')
    .replace(/\bblvd\b\.?/g, 'boulevard')
    .replace(/\bdr\b\.?/g, 'drive')
    .replace(/\bapt\b\.?/g, '')
    .replace(/\bunit\b\.?/g, '')
    .replace(/\b#\d+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function listingKey(listing: Listing): string {
  const addr = normalizeAddress(listing.address);
  return `${addr}-${listing.bedrooms}-${listing.bathrooms}`;
}

export function deduplicateListings(listings: Listing[]): MergedListing[] {
  const groups = new Map<string, Listing[]>();

  for (const listing of listings) {
    const key = listingKey(listing);
    const group = groups.get(key);
    if (group) {
      group.push(listing);
    } else {
      groups.set(key, [listing]);
    }
  }

  const merged: MergedListing[] = [];

  for (const group of groups.values()) {
    // Use the listing with the lowest price as the primary
    group.sort((a, b) => a.price - b.price);
    const primary = group[0];
    const sources = [...new Set(group.map(l => l.source))];

    merged.push({
      ...primary,
      sources,
      sourceCount: sources.length,
    });
  }

  return merged;
}
