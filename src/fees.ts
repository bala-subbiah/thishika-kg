/** Compact annual-fee label for list rows: 0 -> Free, null -> em dash, else $39.9k */
export function shortFee(annual: number | null): string {
  if (annual == null) return "—";
  if (annual === 0) return "Free";
  if (annual < 1000) return `$${annual}`;
  const k = annual / 1000;
  return `$${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/** Full fee line for the detail card. Falls back to the EDB display string. */
export function fullFee(display: string | null, annual: number | null): string {
  if (annual === 0) return "Free";
  if (display && display.trim()) return display.trim();
  if (annual != null) return `$${annual.toLocaleString("en-US")}/yr`;
  return "Not offered";
}
