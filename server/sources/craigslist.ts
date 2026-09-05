import { config } from '../config.js';
import { fetchWithTimeout, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const FEED_URL = 'https://sfbay.craigslist.org/search/apa';

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function tag(item: string, name: string): string {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1]).trim() : '';
}

/** Craigslist encodes the headline facts in the title: `$2500 / 1br - 650ft2 - Sunny flat`. */
function parseTitle(title: string): { price: number | null; bedrooms: number | null; sqft: number | null } {
  const price = title.match(/\$([\d,]+)/);
  const bedrooms = title.match(/(\d+)br/i);
  const sqft = title.match(/(\d+)ft2/i);
  return {
    price: price ? Number(price[1].replace(/,/g, '')) : null,
    bedrooms: bedrooms ? Number(bedrooms[1]) : null,
    sqft: sqft ? Number(sqft[1]) : null,
  };
}

function parseItems(xml: string): RawListing[] {
  const listings: RawListing[] = [];

  for (const match of xml.matchAll(/<item[\s\S]*?<\/item>/g)) {
    const item = match[0];
    const link = tag(item, 'link');
    if (!link) continue;

    const title = tag(item, 'title');
    const { price, bedrooms, sqft } = parseTitle(title);
    if (price === null) continue;

    const posted = Date.parse(tag(item, 'dc:date') || tag(item, 'pubDate'));
    const description = tag(item, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const postId = link.match(/(\d+)\.html/)?.[1] ?? link;

    listings.push({
      sourceId: 'craigslist',
      sourceName: 'Craigslist',
      externalId: postId,
      title: title.replace(/^\$[\d,]+\s*\/\s*/, '').trim() || title,
      description,
      price,
      bedrooms,
      bathrooms: null,
      sqft,
      address: '',
      city: 'San Francisco',
      lat: null,
      lng: null,
      url: link,
      imageUrl: null,
      photoCount: 0,
      postedAt: Number.isNaN(posted) ? null : posted,
      contactEmail: null,
      contactPhone: null,
    });
  }

  return listings;
}

export const craigslistSource: ListingSource = {
  id: 'craigslist',
  name: 'Craigslist',
  enabled: config.enableCraigslist,

  async fetchListings(query: SourceQuery): Promise<RawListing[]> {
    const params = new URLSearchParams({
      format: 'rss',
      min_price: String(query.minRent),
      max_price: String(query.maxRent),
    });
    if (query.bedrooms !== null) params.set('bedrooms', String(query.bedrooms));

    const response = await fetchWithTimeout(`${FEED_URL}?${params}`);
    if (!response.ok) {
      throw new Error(
        `Craigslist responded ${response.status}. They block datacenter IP ranges — ` +
          'this host likely needs a residential proxy.',
      );
    }

    return parseItems(await response.text()).slice(0, query.limit);
  },
};
