import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  label: string;
  mapsUrl: string;
}

/** Close enough to read the street the building sits on, not the whole district. */
const BLOCK_ZOOM = 17;

/**
 * Every card carrying a live Leaflet map at once would mount dozens of maps and
 * pull a tile set for each, so a card only builds its map once it scrolls into
 * view, and tears it down when the card unmounts.
 *
 * The map pans and zooms in place, and expands to fill the window, so the block
 * can be explored without leaving the results. The wheel only zooms once the
 * map has been clicked: a page of maps that each swallowed the wheel would make
 * the results impossible to scroll past.
 */
export function ListingMiniMap({ lat, lng, label, mapsUrl }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wheelZoom, setWheelZoom] = useState(false);

  useEffect(() => {
    const element = holder.current;
    if (!element || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const element = holder.current;
    if (!visible || !element) return;

    const map = L.map(element, {
      center: [lat, lng],
      zoom: BLOCK_ZOOM,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.circleMarker([lat, lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(label);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [visible, lat, lng, label]);

  // Leaflet sizes its tiles to the container it was built in, so growing the
  // box leaves grey gaps until it is told to measure again.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(timer);
  }, [expanded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (wheelZoom) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
  }, [wheelZoom]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const recenter = useCallback(() => {
    mapRef.current?.setView([lat, lng], BLOCK_ZOOM);
  }, [lat, lng]);

  return (
    <div
      className={expanded ? 'fixed inset-0 z-[1200] p-4 flex flex-col gap-2' : 'relative'}
      style={expanded ? { backgroundColor: 'rgba(0,0,0,0.85)' } : undefined}
    >
      {expanded && (
        <div className="flex items-center justify-between text-sm" style={{ color: '#f8fafc' }}>
          <span className="font-medium">{label}</span>
          <span className="text-xs">Drag to pan, scroll to zoom, Esc to close</span>
        </div>
      )}
      <div
        ref={holder}
        onMouseEnter={() => setWheelZoom(expanded)}
        onClick={() => setWheelZoom(true)}
        onMouseLeave={() => setWheelZoom(false)}
        className={`w-full rounded-lg overflow-hidden ${expanded ? 'flex-1' : 'h-44'}`}
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
        aria-label={`Map of ${label}`}
      />
      <div
        className={`flex items-center gap-1.5 ${expanded ? '' : 'absolute top-1.5 right-1.5 z-[500]'}`}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] px-2 py-1 rounded-md font-medium"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {expanded ? 'Close map' : 'Expand map'}
        </button>
        <button
          type="button"
          onClick={recenter}
          className="text-[11px] px-2 py-1 rounded-md font-medium"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Recenter
        </button>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2 py-1 rounded-md font-medium"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          title="Open this address in Google Maps for street view and transit"
        >
          Google Maps
        </a>
      </div>
    </div>
  );
}
