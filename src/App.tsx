import { useEffect, useMemo, useState } from "react";
import type { School, SchemeFilter, SessionFilter, Snapshot } from "./types";
import { haversineKm } from "./geo";
import { useMediaQuery } from "./useMediaQuery";
import MapView from "./MapView";
import Sheet from "./Sheet";
import Sidebar from "./Sidebar";
import Legend from "./Legend";
import FilterChips from "./FilterChips";

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
  const [session, setSession] = useState<SessionFilter>("any");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const desktop = useMediaQuery("(min-width: 900px)");

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
      .filter((s) => session === "any" || offersSession(s, session))
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [snapshot, home, filter, session]);

  const counts = useMemo(() => {
    const all = snapshot?.schools ?? [];
    return {
      all: all.length,
      joining: all.filter((s) => s.scheme).length,
      not: all.filter((s) => !s.scheme).length,
      am: all.filter((s) => offersSession(s, "am")).length,
      pm: all.filter((s) => offersSession(s, "pm")).length,
      wd: all.filter((s) => offersSession(s, "wd")).length,
    };
  }, [snapshot]);

  const selected = ranked.find((s) => s.id === selectedId) ?? null;

  return (
    <div className={"app" + (desktop ? " app--desktop" : "")}>
      <MapView
        home={home}
        schools={ranked}
        selectedId={selectedId}
        onSelect={setSelectedId}
        desktop={desktop}
      />

      {desktop ? (
        <>
          <Sidebar
            schools={ranked}
            selected={selected}
            home={home}
            filter={filter}
            session={session}
            counts={counts}
            onFilter={setFilter}
            onSession={setSession}
            onSelect={setSelectedId}
          />
          <Legend />
          {DEMO && <div className="demo-flag demo-flag--desktop">Demo data — not real schools</div>}
        </>
      ) : (
        <>
          <header className="topbar">
            <div className="masthead">
              <h1>Tai Po Kindergartens</h1>
              <p>
                EDB 2025/26 profile · nearest-first from{" "}
                <strong>Casa Brava</strong>
              </p>
            </div>
            <FilterChips
              filter={filter}
              session={session}
              counts={counts}
              onFilter={setFilter}
              onSession={setSession}
            />
            {DEMO && <div className="demo-flag">Demo data — not real schools</div>}
          </header>

          <Sheet
            schools={ranked}
            selected={selected}
            home={home}
            filter={filter}
            session={session}
            onSelect={setSelectedId}
            onBack={() => setSelectedId(null)}
          />
        </>
      )}

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

/** A session is offered when the profile publishes a fee for it (incl. Free). */
function offersSession(s: School, key: "am" | "pm" | "wd"): boolean {
  return s.fees[key] != null;
}
