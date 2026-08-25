import type { RankedSchool } from "./App";
import { formatKm } from "./geo";
import { shortFee } from "./fees";

interface Props {
  schools: RankedSchool[];
  onSelect: (id: string) => void;
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

export default function SchoolList({ schools, onSelect }: Props) {
  const groups = groupByArea(schools);
  return (
    <div role="list">
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
              role="listitem"
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
