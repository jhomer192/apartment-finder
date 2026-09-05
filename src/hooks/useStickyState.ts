import { useState, useEffect } from 'react';

/**
 * Browsing to a listing or Google Maps and coming back should not silently
 * throw away the neighborhoods and sort someone just set up.
 */
export function useStickyState<T>(key: string, initial: T, parse: (raw: string) => T, serialize: (value: T) => string) {
  const [value, setValue] = useState<T>(() => {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return initial;
    try {
      return parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    sessionStorage.setItem(key, serialize(value));
  }, [key, value, serialize]);

  return [value, setValue] as const;
}
