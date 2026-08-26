import { useCallback, useEffect, useRef, useState } from "react";
import type { Home, SchemeFilter, SessionFilter } from "./types";
import type { RankedSchool } from "./App";
import SchoolList from "./SchoolList";
import SchoolDetail from "./SchoolDetail";

type Snap = "peek" | "half" | "full";

function visibleHeight(snap: Snap): number {
  const vh = window.innerHeight;
  if (snap === "peek") return 128;
  if (snap === "half") return Math.round(vh * 0.47);
  return Math.round(vh * 0.9);
}

interface Props {
  schools: RankedSchool[];
  selected: RankedSchool | null;
  home: Home | null;
  filter: SchemeFilter;
  session: SessionFilter;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const SESSION_LABEL: Record<SessionFilter, string> = {
  any: "",
  am: " · AM",
  pm: " · PM",
  wd: " · whole-day",
};

export default function Sheet({
  schools,
  selected,
  home,
  filter,
  session,
  onSelect,
  onBack,
}: Props) {
  const [snap, setSnap] = useState<Snap>("half");
  const [dragY, setDragY] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  // Opening a school from the peek state lifts the sheet so the detail shows
  useEffect(() => {
    if (selected && snap === "peek") setSnap("half");
    bodyRef.current?.scrollTo({ top: 0 });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      drag.current = {
        startY: e.clientY,
        startH: dragY ?? visibleHeight(snap),
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [snap, dragY],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const h = drag.current.startH + (drag.current.startY - e.clientY);
    const max = Math.round(window.innerHeight * 0.92);
    setDragY(Math.min(max, Math.max(90, h)));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setDragY((h) => {
      if (h != null) {
        const snaps: Snap[] = ["peek", "half", "full"];
        let best: Snap = "half";
        let bestDist = Infinity;
        for (const s of snaps) {
          const d = Math.abs(visibleHeight(s) - h);
          if (d < bestDist) {
            bestDist = d;
            best = s;
          }
        }
        setSnap(best);
      }
      return null;
    });
  }, []);

  const height = dragY ?? visibleHeight(snap);

  // Scrolling the content upward while the sheet is not fully open expands it
  // first (maps-style), so every detail is reachable without hunting for the
  // grabber. Native listeners because React wheel/touch handlers are passive.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let touchY = 0;
    const promote = () => setSnap((s) => (s === "full" ? s : "full"));
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0 && body.scrollTop <= 0) promote();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0].clientY < touchY - 6 && body.scrollTop <= 0) promote();
    };
    body.addEventListener("wheel", onWheel, { passive: true });
    body.addEventListener("touchstart", onTouchStart, { passive: true });
    body.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      body.removeEventListener("wheel", onWheel);
      body.removeEventListener("touchstart", onTouchStart);
      body.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <section
      className={"sheet" + (dragY == null ? " sheet--anim" : "")}
      style={{ height: `${height}px` }}
      aria-label="Kindergarten list"
    >
      <div
        className="grabber"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {!selected && (
        <div
          className="sheet-head"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <h2>
            {schools.length} kindergarten{schools.length === 1 ? "" : "s"}
          </h2>
          <span>
            {(filter === "all"
              ? "nearest first"
              : filter === "joining"
                ? "joining scheme"
                : "not joining") + SESSION_LABEL[session]}
          </span>
        </div>
      )}
      <div className="sheet-body" ref={bodyRef}>
        {selected ? (
          <SchoolDetail school={selected} home={home} onBack={onBack} />
        ) : (
          <SchoolList schools={schools} onSelect={onSelect} />
        )}
      </div>
    </section>
  );
}
