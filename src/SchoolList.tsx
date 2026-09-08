import { useCallback, useEffect, useRef } from "react";
import type { RankedSchool } from "./App";
import { formatKm } from "./geo";
import { shortFee } from "./fees";

interface Props {
  schools: RankedSchool[];
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

export default function SchoolList({ schools, onSelect, returnFocusId }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!returnFocusId) return;
    rootRef.current
      ?.querySelector<HTMLButtonElement>(`.row[data-id="${returnFocusId}"]`)
      ?.focus();
  }, [returnFocusId]);

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
            <button
              key={s.id}
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
          ))}
        </section>
      ))}
    </div>
  );
}
