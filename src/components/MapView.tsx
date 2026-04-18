import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ScoredListing } from '../types';

interface Props {
  listings: ScoredListing[];
  onToggleFavorite: (id: string) => void;
}

const COMMUTE_MARKER_COLORS: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

function createMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px; height: 24px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

export function MapView({ listings, onToggleFavorite }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [37.7749, -122.4194],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when listings change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    if (listings.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    listings.forEach(listing => {
      const color = COMMUTE_MARKER_COLORS[listing.commuteColor] ?? '#94a3b8';
      const icon = createMarkerIcon(color);
      const bedroomLabel = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} BR`;

      const marker = L.marker([listing.lat, listing.lng], { icon });
      marker.bindPopup(`
        <div style="min-width: 180px; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${listing.title}</div>
          <div style="color: #94a3b8; margin-bottom: 4px;">${listing.address}</div>
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            <span style="color: #34d399; font-weight: 600;">$${listing.price.toLocaleString()}/mo</span>
            <span>${bedroomLabel} | ${listing.bathrooms} BA</span>
          </div>
          <div style="color: ${color}; font-weight: 500;">
            ~${listing.commute.estimatedMinutes} min commute
          </div>
          <button
            onclick="document.dispatchEvent(new CustomEvent('toggle-favorite', { detail: '${listing.id}' }))"
            style="margin-top: 6px; padding: 2px 8px; background: #334155; border: 1px solid #475569; border-radius: 4px; color: #e2e8f0; cursor: pointer; font-size: 12px;"
          >
            ${listing.isFavorite ? 'Unsave' : 'Save'}
          </button>
        </div>
      `);

      markersRef.current!.addLayer(marker);
      bounds.push([listing.lat, listing.lng]);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [30, 30] });
    }
  }, [listings]);

  // Listen for favorite toggles from popup buttons
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent).detail as string;
      onToggleFavorite(id);
    }
    document.addEventListener('toggle-favorite', handler);
    return () => document.removeEventListener('toggle-favorite', handler);
  }, [onToggleFavorite]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[500px] rounded-xl border border-slate-700 overflow-hidden"
    />
  );
}
