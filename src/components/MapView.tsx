import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Listing, ScamBand } from '../types';
import { googleMapsUrl } from '../utils/maps';

interface Props {
  listings: Listing[];
  centerLat: number;
  centerLng: number;
}

const BAND_COLOR: Record<ScamBand, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#ef4444',
};

const BAND_LABEL: Record<ScamBand, string> = {
  low: 'Nothing suspicious found',
  medium: 'Worth a closer look',
  high: 'Several scam warning signs',
};

function createPriceIcon(listing: Listing): L.DivIcon {
  const color = BAND_COLOR[listing.scam.band];
  return L.divIcon({
    className: 'listing-marker',
    html: `<div style="
      background: rgba(15,23,42,0.92);
      border: 2px solid ${color};
      border-radius: 14px;
      padding: 2px 7px;
      white-space: nowrap;
      font-size: 11px;
      font-weight: 700;
      color: ${color};
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    ">$${Math.round(listing.price / 100) / 10}k</div>`,
    iconSize: [0, 0],
    iconAnchor: [22, 12],
    popupAnchor: [0, -12],
  });
}

/** Listing text is untrusted, so the popup is built from nodes, never HTML. */
function createPopup(listing: Listing): HTMLElement {
  const root = document.createElement('div');
  root.style.minWidth = '190px';
  root.style.fontSize = '13px';

  const price = document.createElement('div');
  price.style.fontWeight = '700';
  price.textContent = `$${listing.price.toLocaleString()}/mo · ${listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bd`}`;
  root.appendChild(price);

  const address = document.createElement('div');
  address.style.margin = '2px 0 4px';
  address.textContent = `${listing.address || listing.neighborhood}`;
  root.appendChild(address);

  const risk = document.createElement('div');
  risk.style.color = BAND_COLOR[listing.scam.band];
  risk.style.fontWeight = '600';
  risk.textContent = BAND_LABEL[listing.scam.band];
  root.appendChild(risk);

  const links = document.createElement('div');
  links.style.marginTop = '6px';
  links.style.display = 'flex';
  links.style.gap = '10px';

  const listingLink = document.createElement('a');
  listingLink.href = listing.url;
  listingLink.target = '_blank';
  listingLink.rel = 'noopener noreferrer';
  listingLink.textContent = 'View listing';
  links.appendChild(listingLink);

  const mapsLink = document.createElement('a');
  mapsLink.href = googleMapsUrl(listing);
  mapsLink.target = '_blank';
  mapsLink.rel = 'noopener noreferrer';
  mapsLink.textContent = 'Google Maps';
  links.appendChild(mapsLink);

  root.appendChild(links);
  return root;
}

export function MapView({ listings, centerLat, centerLng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'map-tiles-dark',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    listings.forEach(listing => {
      if (listing.lat === null || listing.lng === null) return;
      const marker = L.marker([listing.lat, listing.lng], { icon: createPriceIcon(listing) });
      marker.bindPopup(createPopup(listing));
      markersRef.current!.addLayer(marker);
      bounds.push([listing.lat, listing.lng]);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [listings]);

  const plotted = listings.filter(l => l.lat !== null && l.lng !== null).length;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full h-[600px] rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      />
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        {plotted} of {listings.length} apartments have coordinates. Pin colour is scam risk, the label is rent.
        Click a pin to open the block in Google Maps for transit, street view and your own commute.
      </p>
    </div>
  );
}
