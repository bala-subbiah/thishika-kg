import type { Home } from "./types";
import type { RankedSchool } from "./App";
import { directionsUrl, formatKm } from "./geo";
import { fullFee } from "./fees";

const WALK_SVG = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M13 4.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM9.4 22l2-6.2-2.2-2.1L8 18.3l-2.7-.7 1.7-6.3c.3-1 1.1-1.7 2.1-1.9l3.2-.5c.8-.1 1.6.2 2.1.9l1.3 1.7 2.9 1.2-.8 1.9-3.4-1.4-1.2-1.4-1.1 3.9 2.3 2.3-1.1 4H11l.7-2.9-1.4-1.4L9.4 22H9.4Z"
      fill="currentColor"
    />
  </svg>
);

const CAR_SVG = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5.6 5.8A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L20 10h.8a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1H20.6v4.4a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-1.1H6.8V18a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1v-4.4H3.2a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1H4l1.6-4.2ZM6.3 10h11.4l-1.2-3.5H7.5L6.3 10Zm.2 4.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm11 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"
      fill="currentColor"
    />
  </svg>
);

interface Props {
  school: RankedSchool;
  home: Home | null;
  onBack: () => void;
}

export default function SchoolDetail({ school: s, home, onBack }: Props) {
  const homeQuery = home
    ? `${home.name}, ${home.address}`
    : "Casa Brava, 73 Ting Kok Road, Tai Po";
  const destQuery =
    s.lat != null && s.lng != null && !s.address
      ? `${s.lat},${s.lng}`
      : `${s.name}, ${s.address}`;

  const facts: [string, React.ReactNode][] = [];
  if (s.enrolment) facts.push(["Enrolment", s.enrolment]);
  if (s.teacherPupilRatio) facts.push(["Teacher : pupil", s.teacherPupilRatio]);
  if (s.curriculum) facts.push(["Curriculum", s.curriculum]);
  if (s.tel)
    facts.push([
      "Telephone",
      <a key="tel" href={`tel:${s.tel.replace(/\s+/g, "")}`}>
        {s.tel}
      </a>,
    ]);
  for (const [label, value] of s.extras) facts.push([label, value]);

  return (
    <article className="detail">
      <button type="button" className="back" onClick={onBack}>
        ← All kindergartens
      </button>
      <h2>{s.name}</h2>

      <div className="detail-badges">
        <span className={`tag ${s.scheme ? "tag--scheme" : "tag--open"}`}>
          {s.scheme
            ? "Joining the KG Education Scheme"
            : "Not joining the scheme"}
        </span>
        {s.distanceKm != null && (
          <span className="detail-km">
            {formatKm(s.distanceKm)} from Casa Brava (straight line)
          </span>
        )}
      </div>

      <div className="fee-grid">
        <FeeCell label="AM / year" annual={s.feesAnnual.am} display={s.fees.am} />
        {s.fees.pm != null && (
          <FeeCell label="PM / year" annual={s.feesAnnual.pm} display={s.fees.pm} />
        )}
        <FeeCell label="Whole-day / year" annual={s.feesAnnual.wd} display={s.fees.wd} />
      </div>

      <p className="addr">{s.address}</p>

      <div className="dir-row">
        <a
          className="dir-btn dir-btn--walk"
          href={directionsUrl(homeQuery, destQuery, "walking")}
          target="_blank"
          rel="noopener noreferrer"
        >
          {WALK_SVG} Walk
        </a>
        <a
          className="dir-btn dir-btn--drive"
          href={directionsUrl(homeQuery, destQuery, "driving")}
          target="_blank"
          rel="noopener noreferrer"
        >
          {CAR_SVG} Drive
        </a>
      </div>

      {facts.length > 0 && (
        <div className="facts">
          <h3>From the EDB profile</h3>
          <dl>
            {facts.map(([label, value], i) => (
              <div className="fact" key={i}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="source-note">
        Snapshot of the{" "}
        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
          EDB Kindergarten Profile 2025/26
        </a>
        . Distances are straight-line from Casa Brava, Block 23, 73 Ting Kok
        Road — use the direction buttons for real routes.
      </p>
    </article>
  );
}

function FeeCell(props: {
  label: string;
  annual: number | null;
  display: string | null;
}) {
  const text = fullFee(props.display, props.annual);
  return (
    <div className={"fee-cell" + (text === "Free" ? " fee-cell--free" : "")}>
      <small>{props.label}</small>
      <b>{text}</b>
    </div>
  );
}
