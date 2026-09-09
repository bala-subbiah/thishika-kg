import { useEffect, useMemo, useState } from "react";
import type { School, SchemeFilter, SessionFilter, Snapshot } from "./types";
import { haversineKm } from "./geo";
import { useMediaQuery } from "./useMediaQuery";
import MapView from "./MapView";
import Sheet from "./Sheet";
import Sidebar from "./Sidebar";
import SchoolDetail from "./SchoolDetail";
import Legend from "./Legend";
import FilterChips from "./FilterChips";
import { useShortlist } from "./useShortlist";
import { useHome } from "./useHome";

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
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const desktop = useMediaQuery("(min-width: 900px)");
  const shortlist = useShortlist();
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setSnapshot)
      .catch((e) => setError(String(e)));
  }, []);

  const { home, isCustom, setHome, reset: resetHome } = useHome(
    snapshot?.home ?? null,
  );

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        if (!setHome(pos.coords.latitude, pos.coords.longitude))
          alert("Your location looks outside Hong Kong — home not moved.");
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

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
      .filter((s) => !shortlistOnly || shortlist.ids.includes(s.id))
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [snapshot, home, filter, session, shortlistOnly, shortlist.ids]);

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

  const knownIds = useMemo(
    () => new Set((snapshot?.schools ?? []).map((s) => s.id)),
    [snapshot],
  );
  const favCount = shortlist.ids.filter((id) => knownIds.has(id)).length;
  const importCount = shortlist.importIds.filter((id) =>
    knownIds.has(id),
  ).length;

  // Keyboard: Escape closes the detail view; "/" jumps to search (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLElement &&
        /^(input|textarea|select)$/i.test(e.target.tagName);
      if (e.key === "Escape" && selectedId) {
        setSelectedId(null);
      } else if (e.key === "/" && !inField) {
        const search = document.querySelector<HTMLInputElement>(
          ".sidebar-search input",
        );
        if (search) {
          e.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  return (
    <div
      className={
        "app" +
        (desktop ? " app--desktop" : "") +
        (desktop && selected ? " app--panel-open" : "")
      }
    >
      <MapView
        home={home}
        schools={ranked}
        selectedId={selectedId}
        onSelect={setSelectedId}
        desktop={desktop}
        favIds={shortlist.ids}
        onHomeMove={setHome}
      />

      <div className="home-controls">
        <button type="button" onClick={locate} disabled={locating}>
          {locating ? "Locating…" : "◎ My location"}
        </button>
        {isCustom && (
          <button type="button" className="home-reset" onClick={resetHome}>
            Reset home
          </button>
        )}
      </div>

      {snapshot && importCount > 0 && (
        <div className="import-bar" role="alertdialog" aria-label="Shortlist link">
          <span>
            This link carries a shortlist of <b>{importCount}</b>{" "}
            kindergarten{importCount === 1 ? "" : "s"}.
          </span>
          <button type="button" onClick={shortlist.acceptImport}>
            Add to mine
          </button>
          <button
            type="button"
            className="import-dismiss"
            onClick={shortlist.dismissImport}
          >
            Ignore
          </button>
        </div>
      )}

      {desktop ? (
        <>
          <Sidebar
            schools={ranked}
            selected={selected}
            home={home}
            filter={filter}
            session={session}
            counts={counts}
            favCount={favCount}
            favIds={shortlist.ids}
            shortlistOnly={shortlistOnly}
            onShortlist={() => setShortlistOnly((v) => !v)}
            onToggleFav={shortlist.toggle}
            onFilter={setFilter}
            onSession={setSession}
            onSelect={setSelectedId}
          />
          {selected && (
            <aside className="detail-panel" aria-label="Kindergarten details">
              <div className="detail-panel-scroll">
                <SchoolDetail
                  school={selected}
                  home={home}
                  fav={shortlist.ids.includes(selected.id)}
                  variant="panel"
                  onToggleFav={shortlist.toggle}
                  onBack={() => setSelectedId(null)}
                />
              </div>
            </aside>
          )}
          <Legend customHome={isCustom} />
          {DEMO && <div className="demo-flag demo-flag--desktop">Demo data — not real schools</div>}
        </>
      ) : (
        <>
          <header className="topbar">
            <div className="masthead">
              <h1>Tai Po Kindergartens</h1>
              <p>
                EDB 2025/26 profile · nearest-first from{" "}
                <strong>{isCustom ? "your home" : "Casa Brava"}</strong>
              </p>
            </div>
            <FilterChips
              filter={filter}
              session={session}
              counts={counts}
              favCount={favCount}
              shortlistOnly={shortlistOnly}
              onShortlist={() => setShortlistOnly((v) => !v)}
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
            favIds={shortlist.ids}
            shortlistOnly={shortlistOnly}
            onToggleFav={shortlist.toggle}
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
