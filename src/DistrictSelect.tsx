import type { DistrictInfo } from "./types";

interface Props {
  districts: DistrictInfo[];
  value: string;
  onChange: (id: string) => void;
}

/** The district picker, styled as part of the masthead line. */
export default function DistrictSelect({ districts, value, onChange }: Props) {
  if (districts.length === 0) return <strong>Tai Po</strong>;
  return (
    <select
      className="district-select"
      value={value}
      aria-label="District"
      onChange={(e) => onChange(e.target.value)}
    >
      {districts.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} · {d.count}
        </option>
      ))}
    </select>
  );
}
