import type { SchemeFilter, SessionFilter } from "./types";

export interface Counts {
  all: number;
  joining: number;
  not: number;
  am: number;
  pm: number;
  wd: number;
}

interface Props {
  filter: SchemeFilter;
  session: SessionFilter;
  counts: Counts;
  onFilter: (f: SchemeFilter) => void;
  onSession: (s: SessionFilter) => void;
}

export default function FilterChips({
  filter,
  session,
  counts,
  onFilter,
  onSession,
}: Props) {
  return (
    <>
      <div className="filters" role="tablist" aria-label="Scheme filter">
        <Chip label="All" count={counts.all} on={filter === "all"} onClick={() => onFilter("all")} />
        <Chip
          label="Joining scheme"
          count={counts.joining}
          on={filter === "joining"}
          onClick={() => onFilter("joining")}
        />
        <Chip
          label="Not joining"
          count={counts.not}
          on={filter === "not"}
          onClick={() => onFilter("not")}
        />
      </div>
      <div className="filters" role="tablist" aria-label="Session filter">
        <Chip
          label="Any session"
          count={counts.all}
          on={session === "any"}
          onClick={() => onSession("any")}
        />
        <Chip label="AM" count={counts.am} on={session === "am"} onClick={() => onSession("am")} />
        <Chip label="PM" count={counts.pm} on={session === "pm"} onClick={() => onSession("pm")} />
        <Chip
          label="Whole-day"
          count={counts.wd}
          on={session === "wd"}
          onClick={() => onSession("wd")}
        />
      </div>
    </>
  );
}

function Chip(props: {
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
