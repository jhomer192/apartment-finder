import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SearchResult } from '../types';

interface Props {
  results: SearchResult[];
}

const PIN_COLOR = '#6366f1';

function createNeighborhoodIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'neighborhood-marker',
    html: `<div style="
      display: flex; align-items: center; gap: 4px;
      background: ${color}22;
      border: 2px solid ${color};
      border-radius: 16px;
      padding: 2px 8px 2px 4px;
      white-space: nowrap;
      font-size: 11px;
      font-weight: 600;
      color: ${color};
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 10px; height: 10px;
        background: ${color};
        border-radius: 50%;
        flex-shrink: 0;
      "></div>
      ${label}
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [6, 10],
    popupAnchor: [0, -12],
  });
}

export function MapView({ results }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [39.8283, -98.5795], // US center
      zoom: 4,
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
  }, []);

  // Update markers when results change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    if (results.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    // Add neighborhood markers
    results.forEach(result => {
      result.neighborhoods.forEach(hood => {
        const icon = createNeighborhoodIcon(PIN_COLOR, hood.name);

        const marker = L.marker([hood.lat, hood.lng], { icon });
        marker.bindPopup(`
          <div style="min-width: 160px; font-size: 13px;">
            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text, #e2e8f0);">${hood.name}</div>
            <div style="font-size: 11px; color: var(--text-dim, #94a3b8);">
              ${result.metroName}
            </div>
          </div>
        `);

        markersRef.current!.addLayer(marker);
        bounds.push([hood.lat, hood.lng]);
      });
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [results]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[600px] rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    />
  );
}
