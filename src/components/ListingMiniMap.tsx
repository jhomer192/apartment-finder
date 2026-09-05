import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Every card carrying a live Leaflet map at once would mount dozens of maps and
 * pull a tile set for each, so a card only builds its map once it scrolls into
 * view, and tears it down when the card unmounts.
 */
export function ListingMiniMap({ lat, lng, label }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

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
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      // The card scrolls; a map that eats the wheel would trap the page.
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      keyboard: false,
      touchZoom: false,
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

    return () => {
      map.remove();
    };
  }, [visible, lat, lng, label]);

  return (
    <div
      ref={holder}
      className="w-full h-28 rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
      aria-label={`Map of ${label}`}
    />
  );
}
