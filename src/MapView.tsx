import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { DistrictInfo, Home } from "./types";
import type { RankedSchool } from "./App";

// below this zoom the map shows district bubbles instead of campus pins
const BUBBLE_ZOOM = 10.8;

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const HOME_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9Z"
        fill="currentColor"/></svg>`;

interface Props {
  home: Home | null;
  schools: RankedSchool[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  desktop: boolean;
  favIds: string[];
  onHomeMove: (lat: number, lng: number) => boolean;
  districts: DistrictInfo[];
  districtId: string;
  onDistrict: (id: string) => void;
}

export default function MapView({
  home,
  schools,
  selectedId,
  onSelect,
  desktop,
  favIds,
  onHomeMove,
  districts,
  districtId,
  onDistrict,
}: Props) {
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
    if (window.matchMedia("(min-width: 900px)").matches) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
    }
    // zoom regime: district bubbles far out, campus pins in close
    const applyRegime = () => {
      containerRef.current?.classList.toggle(
        "map--far",
        map.getZoom() < BUBBLE_ZOOM,
      );
    };
    map.on("zoom", applyRegime);
    applyRegime();
    // exposed for debugging and scripted verification
    (window as unknown as { __kgMap?: maplibregl.Map }).__kgMap = map;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      homeMarkerRef.current = null;
      didFitRef.current = false;
    };
  }, []);

  // Home marker — draggable so anyone can move home to their own building
  const onHomeMoveRef = useRef(onHomeMove);
  onHomeMoveRef.current = onHomeMove;
  const homeRef = useRef(home);
  homeRef.current = home;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !home) return;
    if (!homeMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "pin-home";
      el.innerHTML = HOME_SVG;
      el.title = "Home — drag to move";
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([home.lng, home.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        if (!onHomeMoveRef.current(p.lat, p.lng)) {
          // outside HK sanity bounds — snap back
          const h = homeRef.current;
          if (h) marker.setLngLat([h.lng, h.lat]);
        }
      });
      homeMarkerRef.current = marker;
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

    // Campuses sharing one rooftop (same building, or a shared geocode) get
    // fanned out with a screen-space pixel offset so both pins stay visible
    // and tappable at every zoom. Distances and directions use the true point.
    const byCoord = new Map<string, RankedSchool[]>();
    for (const s of schools) {
      if (s.lat == null || s.lng == null) continue;
      const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
      byCoord.set(key, [...(byCoord.get(key) ?? []), s]);
    }
    const pxOffset = new Map<string, [number, number]>();
    for (const group of byCoord.values()) {
      if (group.length === 1) continue;
      const r = 15; // px from the shared point
      group.forEach((s, i) => {
        const a = (2 * Math.PI * i) / group.length - Math.PI / 2;
        pxOffset.set(s.id, [
          Math.round(r * Math.cos(a)),
          Math.round(r * Math.sin(a)),
        ]);
      });
    }

    for (const s of schools) {
      if (s.lat == null || s.lng == null) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = `pin ${s.scheme ? "pin--scheme" : "pin--open"}`;
      el.textContent = String(s.rank);
      el.setAttribute("aria-label", s.name);
      // pins duplicate the list; keep them clickable but out of the tab order
      el.tabIndex = -1;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(s.id);
      });
      const marker = new maplibregl.Marker({
        element: el,
        offset: pxOffset.get(s.id) ?? [0, 0],
      })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      markersRef.current.set(s.id, marker);
    }

    if (!didFitRef.current && schools.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      if (home) bounds.extend([home.lng, home.lat]);
      for (const s of schools)
        if (s.lat != null && s.lng != null) bounds.extend([s.lng, s.lat]);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          // desktop: keep pins clear of the floating 388px sidebar
          padding: desktop
            ? { top: 60, bottom: 80, left: 450, right: 60 }
            : { top: 160, bottom: 180, left: 42, right: 42 },
          maxZoom: 15,
          duration: 0,
        });
        didFitRef.current = true;
      }
    }
  }, [schools, home, onSelect, desktop]);

  // District bubbles (zoomed-out regime) — one marker per district
  const bubblesRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const onDistrictRef = useRef(onDistrict);
  onDistrictRef.current = onDistrict;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || districts.length === 0) return;
    for (const m of bubblesRef.current.values()) m.remove();
    bubblesRef.current.clear();
    for (const d of districts) {
      if (d.lat == null || d.lng == null) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "bubble";
      el.tabIndex = -1;
      el.innerHTML = `<b>${d.count}</b><span>${d.name}</span>`;
      el.setAttribute("aria-label", `${d.name}: ${d.count} kindergartens`);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onDistrictRef.current(d.id);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([d.lng, d.lat])
        .addTo(map);
      bubblesRef.current.set(d.id, marker);
    }
    return () => {
      for (const m of bubblesRef.current.values()) m.remove();
      bubblesRef.current.clear();
    };
  }, [districts]);

  useEffect(() => {
    for (const [id, m] of bubblesRef.current) {
      m.getElement().classList.toggle("bubble--current", id === districtId);
    }
  }, [districtId, districts]);

  // Changing district refits the map to the new set of pins
  const prevDistrictRef = useRef(districtId);
  useEffect(() => {
    if (prevDistrictRef.current !== districtId) {
      prevDistrictRef.current = districtId;
      didFitRef.current = false;
    }
  }, [districtId]);

  // Shortlist badge (markers effect runs first, so this reapplies on rebuild)
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle("pin--fav", favIds.includes(id));
    }
  }, [favIds, schools]);

  // Selection highlight + fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement();
      el.classList.toggle("pin--active", id === selectedId);
      el.classList.toggle("pin--dim", selectedId != null && id !== selectedId);
    }
    const s = schools.find((x) => x.id === selectedId);
    if (s && s.lat != null && s.lng != null) {
      map.flyTo({
        center: [s.lng, s.lat],
        zoom: Math.max(map.getZoom(), desktop ? 15 : 14.6),
        // desktop: center in the strip between the left sidebar (~402px) and
        // the right detail panel (~386px); mobile: keep the pin visible above
        // the half-open sheet
        offset: desktop ? [8, 0] : [0, -window.innerHeight * 0.14],
        duration: 650,
        essential: true,
      });
    }
  }, [selectedId, schools, desktop]);

  return <div ref={containerRef} className="map" />;
}
