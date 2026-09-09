import { useCallback, useEffect, useState } from "react";
import type { DistrictsIndex, DistrictSnapshot } from "./types";
import { haversineKm } from "./geo";

const KEY = "kg-district";
const FALLBACK = "taipo";

/** Districts index + the currently chosen district's snapshot. */
export function useDistricts() {
  const [index, setIndex] = useState<DistrictsIndex | null>(null);
  const [districtId, setDistrictIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? FALLBACK;
    } catch {
      return FALLBACK;
    }
  });
  const [snapshot, setSnapshot] = useState<DistrictSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("data/districts.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setIndex)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let stale = false;
    fetch(`data/kg/${districtId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!stale) setSnapshot(d);
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [districtId]);

  const setDistrictId = useCallback((id: string) => {
    setDistrictIdState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* fine */
    }
  }, []);

  /** District whose centroid is nearest to a point (for geolocate flows). */
  const nearestDistrict = useCallback(
    (lat: number, lng: number): string => {
      let best = FALLBACK;
      let bestD = Infinity;
      for (const d of index?.districts ?? []) {
        if (d.lat == null || d.lng == null) continue;
        const dist = haversineKm(lat, lng, d.lat, d.lng);
        if (dist < bestD) {
          bestD = dist;
          best = d.id;
        }
      }
      return best;
    },
    [index],
  );

  return { index, districtId, setDistrictId, snapshot, error, nearestDistrict };
}
