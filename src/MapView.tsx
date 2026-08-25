import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Home } from "./types";
import type { RankedSchool } from "./App";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const HOME_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9Z"
        fill="currentColor"/></svg>`;

interface Props {
  home: Home | null;
  schools: RankedSchool[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function MapView({ home, schools, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const homeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const didFitRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [114.171, 22.449], // Tai Po town, refined by fitBounds once data lands
      zoom: 13.4,
      attributionControl: { compact: true },
    });
    map.touchPitch.disable();
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      homeMarkerRef.current = null;
      didFitRef.current = false;
    };
  }, []);

  // Home marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !home) return;
    if (!homeMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "pin-home";
      el.innerHTML = HOME_SVG;
      el.title = `${home.name} — home`;
      homeMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([home.lng, home.lat])
        .addTo(map);
    } else {
      homeMarkerRef.current.setLngLat([home.lng, home.lat]);
    }
  }, [home]);

  // School markers — rebuilt when the ranked/filtered list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current.values()) m.remove();
    markersRef.current.clear();

    for (const s of schools) {
      if (s.lat == null || s.lng == null) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = `pin ${s.scheme ? "pin--scheme" : "pin--open"}`;
      el.textContent = String(s.rank);
      el.setAttribute("aria-label", s.name);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(s.id);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      markersRef.current.set(s.id, marker);
    }

    if (!didFitRef.current && (schools.length > 0 || home)) {
      const bounds = new maplibregl.LngLatBounds();
      if (home) bounds.extend([home.lng, home.lat]);
      for (const s of schools)
        if (s.lat != null && s.lng != null) bounds.extend([s.lng, s.lat]);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 160, bottom: 180, left: 42, right: 42 },
          maxZoom: 15,
          duration: 0,
        });
        didFitRef.current = true;
      }
    }
  }, [schools, home, onSelect]);

  // Selection highlight + fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle("pin--active", id === selectedId);
    }
    const s = schools.find((x) => x.id === selectedId);
    if (s && s.lat != null && s.lng != null) {
      map.flyTo({
        center: [s.lng, s.lat],
        zoom: Math.max(map.getZoom(), 14.6),
        // keep the pin visible above the half-open sheet
        offset: [0, -window.innerHeight * 0.14],
        duration: 650,
        essential: true,
      });
    }
  }, [selectedId, schools]);

  return <div ref={containerRef} className="map" />;
}
