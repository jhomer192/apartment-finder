import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SearchResult } from '../types';

interface Props {
  results: SearchResult[];
  officeCoords: { lat: number; lng: number } | null;
}

const COMMUTE_COLORS: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

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

function createOfficeIcon(): L.DivIcon {
  return L.divIcon({
    className: 'office-marker',
    html: `<div style="
      width: 32px; height: 32px;
      background: var(--accent, #6366f1);
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export function MapView({ results, officeCoords }: Props) {
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

  // Update markers when results change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    if (results.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    // Add office marker if available
    if (officeCoords) {
      const officeIcon = createOfficeIcon();
      const officeMarker = L.marker([officeCoords.lat, officeCoords.lng], { icon: officeIcon, zIndexOffset: 1000 });
      officeMarker.bindPopup(`
        <div style="font-size: 13px; font-weight: 600; color: var(--text, #e2e8f0);">
          Your Office
        </div>
      `);
      markersRef.current.addLayer(officeMarker);
      bounds.push([officeCoords.lat, officeCoords.lng]);
    }

    // Add neighborhood markers
    results.forEach(result => {
      result.neighborhoods.forEach(hood => {
        const color = COMMUTE_COLORS[hood.commuteColor] ?? '#94a3b8';
        const icon = createNeighborhoodIcon(color, hood.name);

        const marker = L.marker([hood.lat, hood.lng], { icon });
        marker.bindPopup(`
          <div style="min-width: 160px; font-size: 13px;">
            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text, #e2e8f0);">${hood.name}</div>
            <div style="display: flex; gap: 12px; color: var(--text-dim, #94a3b8);">
              <span style="color: ${color}; font-weight: 600;">~${hood.estimatedMinutes} min</span>
              <span>${hood.distanceMiles} mi</span>
            </div>
            <div style="margin-top: 4px; font-size: 11px; color: var(--text-dim, #94a3b8);">
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
  }, [results, officeCoords]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[600px] rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    />
  );
}
