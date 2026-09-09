import { useCallback, useState } from "react";
import type { Home } from "./types";

const KEY = "kg-home";
// sanity bounds: roughly Hong Kong territory
const IN_HK = (lat: number, lng: number) =>
  lat > 22.1 && lat < 22.62 && lng > 113.8 && lng < 114.5;

function load(): { lat: number; lng: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && IN_HK(v.lat, v.lng) ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

/** User-movable home point; falls back to the snapshot default (Casa Brava). */
export function useHome(defaultHome: Home | null) {
  const [override, setOverride] = useState<{ lat: number; lng: number } | null>(
    load,
  );

  const setHome = useCallback((lat: number, lng: number): boolean => {
    if (!IN_HK(lat, lng)) return false;
    const v = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    setOverride(v);
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* non-persistent contexts still work for the session */
    }
    return true;
  }, []);

  const reset = useCallback(() => {
    setOverride(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const home: Home | null = defaultHome
    ? override
      ? { name: "Your home", address: "Custom location", ...override, custom: true }
      : defaultHome
    : null;

  return { home, isCustom: override != null, setHome, reset };
}
