import { useCallback, useEffect, useRef } from "react";
import type { RankedSchool } from "./App";
import { formatKm } from "./geo";
import { shortFee } from "./fees";
import Star from "./Star";

interface Props {
  schools: RankedSchool[];
  favIds: string[];
  /** Highlight + keep in view (desktop master–detail) */
  selectedId?: string | null;
  onToggleFav: (id: string) => void;
  onSelect: (id: string) => void;
  /** Row to restore keyboard focus to (after coming back from the detail) */
  returnFocusId?: string | null;
}

interface AreaGroup {
  area: string;
  schools: RankedSchool[];
}

/** Group by area, keeping the nearest-first order: groups appear in order of
 *  their nearest campus, rows inside keep their global rank. */
function groupByArea(schools: RankedSchool[]): AreaGroup[] {
  const groups = new Map<string, RankedSchool[]>();
  for (const s of schools) {
    const area = s.area ?? "Tai Po";
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area)!.push(s);
  }
  return [...groups.entries()].map(([area, list]) => ({ area, schools: list }));
}

export default function SchoolList({
  schools,
  favIds,
  selectedId,
  onToggleFav,
  onSelect,
  returnFocusId,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!returnFocusId) return;
    rootRef.current
      ?.querySelector<HTMLButtonElement>(`.row[data-id="${returnFocusId}"]`)
      ?.focus();
  }, [returnFocusId]);

  // keep the selected row in view (without stealing keyboard focus)
  useEffect(() => {
    if (!selectedId) return;
    rootRef.current
      ?.querySelector(`.row[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Arrow keys walk the rows; Home/End jump. Enter/Space stay native.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const rows = [
      ...(rootRef.current?.querySelectorAll<HTMLButtonElement>(".row") ?? []),
    ];
    if (rows.length === 0) return;
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    else if (i === -1) next = 0;
    else next = Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)));
    e.preventDefault();
    rows[next].focus();
    rows[next].scrollIntoView({ block: "nearest" });
  }, []);

  const groups = groupByArea(schools);
  if (schools.length === 0) {
    return (
      <p className="no-results">
        Nothing here yet. Tap the ☆ on any kindergarten to build your
        shortlist, or loosen the filters above.
      </p>
    );
  }
  return (
    <div ref={rootRef} aria-label="Kindergartens, nearest first" onKeyDown={onKeyDown}>
      {groups.map((g) => (
        <section key={g.area}>
          <header className="area-head">
            <span>{g.area}</span>
            <small>
              {g.schools.length} · from {formatKm(g.schools[0].distanceKm ?? 0)}
            </small>
          </header>
          {g.schools.map((s) => (
            <div
              className={
                "rowwrap" + (s.id === selectedId ? " rowwrap--selected" : "")
              }
              key={s.id}
            >
            <button
              type="button"
              data-id={s.id}
              className="row"
              onClick={() => onSelect(s.id)}
            >
              <span
                className={`rank ${s.scheme ? "rank--scheme" : "rank--open"}`}
              >
                {s.rank}
              </span>
              <span className="row-main">
                <span className="row-name">{s.name}</span>
                <span className="row-sub">
                  <span
                    className={`tag ${s.scheme ? "tag--scheme" : "tag--open"}`}
                  >
                    {s.scheme ? "Scheme" : "Non-scheme"}
                  </span>
                  <span className="row-fees">
                    AM <b>{shortFee(s.feesAnnual.am)}</b> · Whole-day{" "}
                    <b>{shortFee(s.feesAnnual.wd)}</b>
                  </span>
                </span>
              </span>
              <span className="row-side">
                {s.distanceKm != null && (
                  <>
                    <span className="row-km">{formatKm(s.distanceKm)}</span>
                    <small>from home</small>
                  </>
                )}
              </span>
            </button>
            <Star
              on={favIds.includes(s.id)}
              name={s.name}
              onToggle={() => onToggleFav(s.id)}
            />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
