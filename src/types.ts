export interface Fees {
  /** Display strings as published by EDB, e.g. "$18,000 (10 instalments)" or "Free" */
  am: string | null;
  pm: string | null;
  wd: string | null;
}

export interface School {
  /** EDB school id used by schoolinfo.php?schid={id} */
  id: string;
  name: string;
  /** Joined the Kindergarten Education Scheme */
  scheme: boolean;
  lat: number | null;
  lng: number | null;
  address: string;
  /** Neighbourhood within Tai Po (estate/court/street), for list grouping */
  area?: string;
  tel: string | null;
  fees: Fees;
  /** Annual fee in HK$ parsed from the display string (0 = free), null = unknown/not offered */
  feesAnnual: { am: number | null; pm: number | null; wd: number | null };
  enrolment: string | null;
  teacherPupilRatio: string | null;
  curriculum: string | null;
  /** Any remaining EDB profile facts, label -> value, in page order */
  extras: [string, string][];
  sourceUrl: string;
}

export interface Home {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** true until the geocode pipeline has resolved the exact rooftop point */
  estimated?: boolean;
  /** true when the user moved home away from the built-in default */
  custom?: boolean;
}

export interface DistrictInfo {
  id: string;
  name: string;
  count: number;
  scheme: number;
  lat: number | null;
  lng: number | null;
}

export interface DistrictsIndex {
  generatedAt: string;
  profileYear: string;
  districts: DistrictInfo[];
}

export interface DistrictSnapshot {
  generatedAt: string | null;
  profileYear: string;
  source: string;
  district: { id: string; name: string };
  schools: School[];
}

export type SchemeFilter = "all" | "joining" | "not";
export type SessionFilter = "any" | "am" | "pm" | "wd";
