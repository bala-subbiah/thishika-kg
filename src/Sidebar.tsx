import { useMemo, useState } from "react";
import type { Home, SchemeFilter, SessionFilter } from "./types";
import type { RankedSchool } from "./App";
import FilterChips, { type Counts } from "./FilterChips";
import SchoolList from "./SchoolList";
import ShareButton from "./ShareButton";
import { formatKm } from "./geo";

interface Props {
  schools: RankedSchool[];
  selected: RankedSchool | null;
  home: Home | null;
  filter: SchemeFilter;
  session: SessionFilter;
  counts: Counts;
  favCount: number;
  favIds: string[];
  shortlistOnly: boolean;
  onShortlist: () => void;
  onToggleFav: (id: string) => void;
  onFilter: (f: SchemeFilter) => void;
  onSession: (s: SessionFilter) => void;
  onSelect: (id: string | null) => void;
}

export default function Sidebar({
  schools,
  selected,
  home,
  filter,
  session,
  counts,
  favCount,
  favIds,
  shortlistOnly,
  onShortlist,
  onToggleFav,
  onFilter,
  onSession,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.area ?? "").toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q),
    );
  }, [schools, query]);

  const stats = useMemo(() => {
    const freeAm = schools.filter((s) => s.feesAnnual.am === 0).length;
    const nearest = schools[0]?.distanceKm;
    return { freeAm, nearest };
  }, [schools]);

  return (
    <aside className="sidebar" aria-label="Kindergarten explorer">
          <header className="sidebar-head">
            <h1>Tai Po Kindergartens</h1>
            <p>
              EDB 2025/26 profile · nearest-first from{" "}
              {home?.custom ? (
                <strong>your home</strong>
              ) : (
                <>
                  <strong>Casa Brava</strong>, 73 Ting Kok Road
                </>
              )}{" "}
              · drag the <strong>⌂</strong> pin to move home
            </p>
          </header>

          <div className="sidebar-search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="m15.5 15.5 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search a kindergarten, area or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search kindergartens"
            />
          </div>

          <div className="stat-grid">
            <div className="stat">
              <b>{counts.all}</b>
              <small>campuses</small>
            </div>
            <div className="stat">
              <b>{counts.joining}</b>
              <small>joining scheme</small>
            </div>
            <div className="stat">
              <b>{stats.freeAm}</b>
              <small>free AM session</small>
            </div>
            <div className="stat">
              <b>{stats.nearest != null ? formatKm(stats.nearest) : "—"}</b>
              <small>nearest campus</small>
            </div>
          </div>

          <div className="sidebar-filters">
            <FilterChips
              filter={filter}
              session={session}
              counts={counts}
              favCount={favCount}
              shortlistOnly={shortlistOnly}
              onShortlist={onShortlist}
              onFilter={onFilter}
              onSession={onSession}
            />
          </div>

          <div className="sidebar-listwrap">
            <div className="sheet-head sidebar-listhead">
              <h2>
                {visible.length} kindergarten{visible.length === 1 ? "" : "s"}
              </h2>
              {shortlistOnly && favCount > 0 ? (
                <ShareButton ids={favIds} />
              ) : (
                <span>nearest first</span>
              )}
            </div>
            <div className="sidebar-scroll">
              {visible.length > 0 ? (
                <SchoolList
                  schools={visible}
                  favIds={favIds}
                  selectedId={selected?.id ?? null}
                  onToggleFav={onToggleFav}
                  onSelect={onSelect}
                />
              ) : (
                <p className="no-results">No kindergartens match “{query}”.</p>
              )}
            </div>
          </div>
    </aside>
  );
}
