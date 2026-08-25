#!/usr/bin/env node
/**
 * One-shot snapshot of the EDB Kindergarten Profile 2025/26 — Tai Po district.
 *
 *   1. Fetch the district list page and collect GoSchoolDetail('<id>') ids.
 *   2. Fetch each schoolinfo.php?lang=en&schid=<id> page (cached in scripts/cache/).
 *   3. Parse label/value tables into a typed record; unmapped labels land in `extras`.
 *   4. Geocode each address with the HK Address Lookup Service (www.als.gov.hk),
 *      converting HK1980 grid -> WGS84 with proj4. Also geocodes Casa Brava (home).
 *   5. Write public/data/schools.json and print a parse report.
 *
 * The live site never calls EDB — this runs once, at build time, by hand.
 *
 * Flags:  --no-geocode   skip step 4 (coordinates stay null)
 *         --limit N      only scrape the first N schools (debugging)
 *
 * If the EDB markup differs from what the parser expects, every raw page is in
 * scripts/cache/*.html and the report lists exactly which fields were missed.
 */
import { load } from "cheerio";
import proj4 from "proj4";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, "scripts", "cache");
const OUT = path.join(ROOT, "public", "data", "schools.json");

const BASE = "https://kgp2025.azurewebsites.net/edb";
const LIST_URL = `${BASE}/school.php?lang=en&district=taipo`;
const DETAIL_URL = (id) => `${BASE}/schoolinfo.php?lang=en&schid=${encodeURIComponent(id)}`;
const ALS_URL = (q) => `https://www.als.gov.hk/lookup?q=${encodeURIComponent(q)}&n=1`;

const HOME = {
  name: "Casa Brava",
  address: "73 Ting Kok Road, Tai Po, New Territories",
  geocodeQuery: "CASA BRAVA 73 TING KOK ROAD TAI PO",
};

// EPSG:2326 — Hong Kong 1980 Grid System
proj4.defs(
  "EPSG:2326",
  "+proj=tmerc +lat_0=22.31213333333334 +lon_0=114.1785555555556 +k=1 " +
    "+x_0=836694.05 +y_0=819069.8 +ellps=intl " +
    "+towgs84=-162.619,-276.959,-161.764,0.067753,-2.243649,-1.158827,-1.094246 " +
    "+units=m +no_defs",
);

const NO_GEOCODE = process.argv.includes("--no-geocode");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
};

fs.mkdirSync(CACHE, { recursive: true });

async function fetchText(url, cacheKey) {
  const file = path.join(CACHE, cacheKey);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (kindergarten snapshot; one-time)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  await new Promise((r) => setTimeout(r, 400)); // be gentle with the host
  return text;
}

/* ------------------------------------------------------------------ list -- */

function parseList(html) {
  const $ = load(html);
  const schools = [];
  const seen = new Set();
  // ids appear as GoSchoolDetail('id') on rows/links; take the nearest row text as name
  $("[onclick*='GoSchoolDetail'], a[href*='GoSchoolDetail']").each((_, el) => {
    const attr = ($(el).attr("onclick") || $(el).attr("href") || "").toString();
    const m = attr.match(/GoSchoolDetail\(\s*['"]([^'"]+)['"]\s*\)/);
    if (!m) return;
    const id = m[1];
    if (seen.has(id)) return;
    seen.add(id);
    const row = $(el).closest("tr");
    const name = clean((row.length ? row : $(el)).text()).replace(/\s{2,}/g, " ");
    schools.push({ id, listName: name });
  });
  if (schools.length === 0) {
    // fallback: raw regex across the document
    for (const m of html.matchAll(/GoSchoolDetail\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        schools.push({ id: m[1], listName: null });
      }
    }
  }
  return schools;
}

/* ---------------------------------------------------------------- detail -- */

const clean = (s) =>
  (s ?? "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

/** Flatten every table on the page into ordered [label, value] pairs. */
function extractFields($) {
  const fields = [];
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("th, td")
      .toArray()
      .map((c) => clean($(c).text()));
    if (cells.length >= 2 && cells[0]) {
      fields.push([cells[0], cells.slice(1).filter(Boolean).join(" | ")]);
    }
  });
  // some EDB pages use dl or label/value div pairs
  $("dt").each((i, dt) => {
    const dd = $(dt).next("dd");
    if (dd.length) fields.push([clean($(dt).text()), clean(dd.text())]);
  });
  return fields.filter(([l, v]) => l && v);
}

const FEE_NA = /^(-|–|—|n\.?a\.?|nil|not applicable|no such session)$/i;

function parseFeeValue(raw) {
  if (raw == null) return { display: null, annual: null };
  const t = clean(String(raw));
  if (!t || FEE_NA.test(t)) return { display: null, annual: null };
  if (/^free$/i.test(t) || /^\$?\s*0(\.0+)?$/.test(t.replace(/,/g, "")))
    return { display: t, annual: 0 };
  const m = t.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return { display: t, annual: m ? Math.round(Number(m[1])) : null };
}

function matchLabel(label, ...needles) {
  const l = label.toLowerCase();
  return needles.some((n) => l.includes(n));
}

function parseDetail(html, id, listName) {
  const $ = load(html);
  const fields = extractFields($);

  const name =
    clean($("h1").first().text()) ||
    clean($("h2").first().text()) ||
    listName ||
    `School ${id}`;

  const school = {
    id,
    name,
    scheme: false,
    lat: null,
    lng: null,
    address: "",
    tel: null,
    fees: { am: null, pm: null, wd: null },
    feesAnnual: { am: null, pm: null, wd: null },
    enrolment: null,
    teacherPupilRatio: null,
    curriculum: null,
    extras: [],
    sourceUrl: DETAIL_URL(id),
  };

  const enrolmentParts = [];
  let schemeSeen = false;

  for (const [label, value] of fields) {
    const v = clean(value);
    if (matchLabel(label, "kindergarten education scheme", "joined the scheme")) {
      school.scheme = /^yes/i.test(v);
      schemeSeen = true;
    } else if (matchLabel(label, "address")) {
      if (!school.address) school.address = v.replace(/\n/g, ", ");
    } else if (matchLabel(label, "telephone", "tel.", "phone")) {
      if (!school.tel) school.tel = v;
    } else if (matchLabel(label, "fee")) {
      // fee rows usually name the session in the label or sit in a sessions table
      const l = label.toLowerCase();
      const target = /whole[\s-]*day|wd/.test(l)
        ? "wd"
        : /\bpm\b|afternoon/.test(l)
          ? "pm"
          : /\bam\b|morning|half[\s-]*day/.test(l)
            ? "am"
            : null;
      if (target) {
        const fee = parseFeeValue(v);
        school.fees[target] = fee.display;
        school.feesAnnual[target] = fee.annual;
      } else if (/\|/.test(v)) {
        // one row, several session columns: assume AM | PM | WD column order
        const parts = v.split("|").map((p) => parseFeeValue(p));
        const keys = ["am", "pm", "wd"];
        parts.slice(0, 3).forEach((fee, i) => {
          school.fees[keys[i]] = fee.display;
          school.feesAnnual[keys[i]] = fee.annual;
        });
        school.extras.push([clean(label), v]); // keep the raw row too
      } else {
        school.extras.push([clean(label), v]);
      }
    } else if (matchLabel(label, "enrolment", "enrolled", "number of students", "no. of students")) {
      enrolmentParts.push(`${clean(label)}: ${v}`);
    } else if (matchLabel(label, "teacher to pupil", "teacher-pupil", "teacher : pupil", "pupil ratio")) {
      if (!school.teacherPupilRatio) school.teacherPupilRatio = v;
    } else if (matchLabel(label, "curriculum", "learning / teaching mode", "approach")) {
      school.curriculum = school.curriculum ? `${school.curriculum}; ${v}` : v;
    } else if (matchLabel(label, "school name")) {
      if (v && v.length > 3) school.name = v;
    } else {
      school.extras.push([clean(label), v]);
    }
  }

  if (enrolmentParts.length) school.enrolment = enrolmentParts.join(" · ");
  if (!schemeSeen) warn(`${id} (${school.name}): scheme field not found`);
  if (!school.address) warn(`${id} (${school.name}): address not found`);
  if (school.feesAnnual.am == null && school.feesAnnual.wd == null && school.feesAnnual.pm == null)
    warn(`${id} (${school.name}): no fees parsed — check scripts/cache/${id}.html`);
  return school;
}

/* --------------------------------------------------------------- geocode -- */

async function geocode(query, cacheKeySafe) {
  const file = path.join(CACHE, `geo-${cacheKeySafe}.json`);
  let data;
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } else {
    const res = await fetch(ALS_URL(query), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ALS ${res.status} for "${query}"`);
    data = await res.json();
    fs.writeFileSync(file, JSON.stringify(data));
    await new Promise((r) => setTimeout(r, 300));
  }
  const sugg = data?.SuggestedAddress?.[0]?.Address?.PremisesAddress;
  const geo = sugg?.GeospatialInformation;
  const gi = Array.isArray(geo) ? geo[0] : geo;
  if (!gi?.Northing || !gi?.Easting) return null;
  const [lng, lat] = proj4("EPSG:2326", "WGS84", [
    Number(gi.Easting),
    Number(gi.Northing),
  ]);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

/* ------------------------------------------------------------------ main -- */

const listHtml = await fetchText(LIST_URL, "list.html");
let list = parseList(listHtml);
if (list.length === 0) {
  console.error("No GoSchoolDetail ids found on the list page — inspect scripts/cache/list.html");
  process.exit(1);
}
console.log(`List page: ${list.length} Tai Po campuses found (expected ~36).`);
if (list.length < 30) warn(`only ${list.length} campuses found — verify the list page markup`);
list = list.slice(0, LIMIT);

const schools = [];
for (const { id, listName } of list) {
  const html = await fetchText(DETAIL_URL(id), `${id}.html`);
  const school = parseDetail(html, id, listName);
  console.log(`  ✓ ${school.name}`);
  schools.push(school);
}

let home = { name: HOME.name, address: HOME.address, lat: 22.4523, lng: 114.1729, estimated: true };
if (!NO_GEOCODE) {
  const homeGeo =
    (await geocode(HOME.geocodeQuery, "home").catch(() => null)) ??
    (await geocode("73 TING KOK ROAD TAI PO", "home-fallback").catch(() => null));
  if (homeGeo) home = { name: HOME.name, address: HOME.address, ...homeGeo };
  else warn("home (Casa Brava) geocode failed — keeping estimated coordinates");

  for (const s of schools) {
    if (!s.address) continue;
    try {
      const geo = await geocode(s.address.toUpperCase(), s.id);
      if (geo) Object.assign(s, geo);
      else warn(`${s.id} (${s.name}): ALS returned no geometry`);
    } catch (e) {
      warn(`${s.id} (${s.name}): geocode failed — ${e.message}`);
    }
  }
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: LIST_URL,
  home,
  schools,
};

fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`\nWrote ${OUT} — ${schools.length} schools.`);
console.log(
  `Scheme: ${schools.filter((s) => s.scheme).length} joining, ${schools.filter((s) => !s.scheme).length} not.`,
);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  console.log("Raw pages are cached in scripts/cache/ for inspection.");
  process.exitCode = 2;
}
