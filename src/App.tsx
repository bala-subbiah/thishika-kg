import { useEffect, useMemo, useState } from "react";
import type { School, SchemeFilter, Snapshot } from "./types";
import { haversineKm } from "./geo";
import MapView from "./MapView";
import Sheet from "./Sheet";

export interface RankedSchool extends School {
  rank: number;
  distanceKm: number | null;
}

const DEMO = new URLSearchParams(window.location.search).has("demo");
const DATA_URL = DEMO ? "data/demo-schools.json" : "data/schools.json";

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SchemeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setSnapshot)
      .catch((e) => setError(String(e)));
  }, []);

  const home = snapshot?.home ?? null;

  const ranked: RankedSchool[] = useMemo(() => {
    if (!snapshot || !home) return [];
    const withDistance = snapshot.schools.map((s) => ({
      ...s,
      distanceKm:
        s.lat != null && s.lng != null
          ? haversineKm(home.lat, home.lng, s.lat, s.lng)
          : null,
    }));
    withDistance.sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    return withDistance
      .filter((s) =>
        filter === "all" ? true : filter === "joining" ? s.scheme : !s.scheme,
      )
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [snapshot, home, filter]);

  const counts = useMemo(() => {
    const all = snapshot?.schools ?? [];
    return {
      all: all.length,
      joining: all.filter((s) => s.scheme).length,
      not: all.filter((s) => !s.scheme).length,
    };
  }, [snapshot]);

  const selected = ranked.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="app">
      <MapView
        home={home}
        schools={ranked}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <header className="topbar">
        <div className="masthead">
          <h1>Tai Po Kindergartens</h1>
          <p>
            EDB 2025/26 profile · nearest-first from <strong>Casa Brava</strong>
          </p>
        </div>
        <div className="filters" role="tablist" aria-label="Scheme filter">
          <FilterChip
            label="All"
            count={counts.all}
            on={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Joining scheme"
            count={counts.joining}
            on={filter === "joining"}
            onClick={() => setFilter("joining")}
          />
          <FilterChip
            label="Not joining"
            count={counts.not}
            on={filter === "not"}
            onClick={() => setFilter("not")}
          />
        </div>
        {DEMO && <div className="demo-flag">Demo data — not real schools</div>}
      </header>

      <Sheet
        schools={ranked}
        selected={selected}
        home={home}
        filter={filter}
        onSelect={setSelectedId}
        onBack={() => setSelectedId(null)}
      />

      {snapshot && snapshot.schools.length === 0 && (
        <div className="empty">
          <div className="empty-card">
            <h2>Snapshot not generated yet</h2>
            <p>
              This page ships with a one-time snapshot of the EDB 2025/26
              Kindergarten Profile for Tai Po. The snapshot file{" "}
              <code>data/schools.json</code> is empty.
            </p>
            <p>
              Run <code>npm run scrape</code> on a machine that can reach{" "}
              <code>kgp2025.azurewebsites.net</code>, then rebuild. Append{" "}
              <code>?demo</code> to the URL to preview the design with sample
              data.
            </p>
          </div>
        </div>
      )}
      {error && (
        <div className="empty">
          <div className="empty-card">
            <h2>Could not load data</h2>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip(props: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.on}
      className={"chip" + (props.on ? " chip--on" : "")}
      onClick={props.onClick}
    >
      {props.label}
      <span className="count">{props.count}</span>
    </button>
  );
}
