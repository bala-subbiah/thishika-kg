import { useEffect, useMemo, useState } from "react";
import type { Home, School, SchemeFilter, SessionFilter } from "./types";
import { haversineKm } from "./geo";
import { useMediaQuery } from "./useMediaQuery";
import { useDistricts } from "./useDistricts";
import { useShortlist } from "./useShortlist";
import { useHome } from "./useHome";
import MapView from "./MapView";
import Sheet from "./Sheet";
import Sidebar from "./Sidebar";
import SchoolDetail from "./SchoolDetail";
import Legend from "./Legend";
import FilterChips from "./FilterChips";
import DistrictSelect from "./DistrictSelect";

export interface RankedSchool extends School {
  rank: number;
  distanceKm: number | null;
}

// The app's origin story and default home: Casa Brava, Tai Po (ALS rooftop).
const DEFAULT_HOME: Home = {
  name: "Casa Brava",
  address: "73 Ting Kok Road, Tai Po, New Territories",
  lat: 22.462479,
  lng: 114.189515,
};

const WELCOME_KEY = "kg-welcomed";

export default function App() {
  const { index, districtId, setDistrictId, snapshot, error, nearestDistrict } =
    useDistricts();
  const [filter, setFilter] = useState<SchemeFilter>("all");
  const [session, setSession] = useState<SessionFilter>("any");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [locating, setLocating] = useState(false);
  const [welcomed, setWelcomed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) === "1";
    } catch {
      return true;
    }
  });
  const desktop = useMediaQuery("(min-width: 900px)");
  const shortlist = useShortlist();
  const { home, isCustom, setHome, reset: resetHome } = useHome(DEFAULT_HOME);

  const dismissWelcome = () => {
    setWelcomed(true);
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* fine */
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        dismissWelcome();
        const { latitude: lat, longitude: lng } = pos.coords;
        if (setHome(lat, lng)) {
          setDistrictId(nearestDistrict(lat, lng));
          setSelectedId(null);
        } else {
          alert("Your location looks outside Hong Kong — home not moved.");
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const switchDistrict = (id: string) => {
    setDistrictId(id);
    setSelectedId(null);
  };

  const districtName = snapshot?.district.name ?? "";

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
        districts={index?.districts ?? []}
        districtId={districtId}
        onDistrict={switchDistrict}
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
            districts={index?.districts ?? []}
            districtId={districtId}
            profileYear={snapshot?.profileYear ?? "2025/26"}
            onDistrict={switchDistrict}
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
        </>
      ) : (
        <>
          <header className="topbar">
            <div className="masthead">
              <h1>HK Kindergarten Map</h1>
              <p>
                <DistrictSelect
                  districts={index?.districts ?? []}
                  value={districtId}
                  onChange={switchDistrict}
                />{" "}
                · nearest-first from{" "}
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

      {!welcomed && index && (
        <div className="welcome" role="dialog" aria-label="Welcome">
          <div className="welcome-card">
            <h2>HK Kindergarten Map</h2>
            <p>
              Every EDB-profiled kindergarten in Hong Kong — fees, scheme
              status and straight-line distances, <b>nearest-first from your
              home</b>.
            </p>
            <button type="button" className="welcome-locate" onClick={locate}>
              {locating ? "Locating…" : "◎ Use my location"}
            </button>
            <button type="button" className="welcome-skip" onClick={dismissWelcome}>
              Browse without my location
            </button>
            <small>
              Distances measure from the ⌂ home pin — drag it to your building
              anytime.
            </small>
          </div>
        </div>
      )}

      {snapshot && snapshot.schools.length === 0 && (
        <div className="empty">
          <div className="empty-card">
            <h2>No data for {districtName}</h2>
            <p>
              The snapshot for this district is empty — run{" "}
              <code>npm run scrape</code> and rebuild.
            </p>
          </div>
        </div>
      )}
      {error && !snapshot && (
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
