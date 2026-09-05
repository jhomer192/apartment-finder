/**
 * We deliberately do not compute commutes or rate how safe a block is: the
 * honest version of both is handing the address to a map everyone already
 * knows how to read.
 */
export function googleMapsUrl(listing: {
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
}): string {
  const query = listing.address.trim()
    ? `${listing.address}, San Francisco, CA`
    : listing.lat !== null && listing.lng !== null
      ? `${listing.lat},${listing.lng}`
      : `${listing.neighborhood}, San Francisco, CA`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
