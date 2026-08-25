import type { RankedSchool } from "./App";
import { formatKm } from "./geo";
import { shortFee } from "./fees";

interface Props {
  schools: RankedSchool[];
  onSelect: (id: string) => void;
}

export default function SchoolList({ schools, onSelect }: Props) {
  return (
    <div role="list">
      {schools.map((s) => (
        <button
          key={s.id}
          type="button"
          role="listitem"
          className="row"
          onClick={() => onSelect(s.id)}
        >
          <span className={`rank ${s.scheme ? "rank--scheme" : "rank--open"}`}>
            {s.rank}
          </span>
          <span className="row-main">
            <span className="row-name">{s.name}</span>
            <span className="row-sub">
              <span className={`tag ${s.scheme ? "tag--scheme" : "tag--open"}`}>
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
    </div>
  );
}
