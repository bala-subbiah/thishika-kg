#!/usr/bin/env node
/**
 * One-shot snapshot of the EDB Kindergarten Profile 2025/26 — Tai Po district.
 *
 *   1. Fetch the district list page; collect GoSchoolDetail('<id>') ids + names
 *      (each school appears twice on the page — dedupe by id, 36 campuses).
 *   2. Fetch each schoolinfo.php?lang=en&schid=<id> page (cached in scripts/cache/).
 *   3. Parse the profile: scheme banner, address/tel, the Annual Fees and
 *      Enrolment session×level tables, ratios, curriculum, curated extras.
 *   4. Geocode each address + Casa Brava (home) with the HK Address Lookup
 *      Service (www.als.gov.hk), converting HK1980 grid -> WGS84 with proj4.
 *   5. Write public/data/schools.json and print a parse report.
 *
 * The live site never calls EDB — this runs once, at build time, by hand.
 *
 * Flags:  --no-geocode   skip step 4 (coordinates stay null)
 *         --limit N      only scrape the first N schools (debugging)
 */
import { load } from "cheerio";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import proj4 from "proj4";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// honour HTTPS_PROXY etc. when present (Node fetch ignores them by default)
if (process.env.HTTPS_PROXY || process.env.https_proxy)
  setGlobalDispatcher(new EnvHttpProxyAgent());

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, "scripts", "cache");

// Annual refresh: when the next edition appears (kgp2026 for 2026/27),
// run KGP_YEAR=2026 npm run scrape and review the parse report.
const YEAR = process.env.KGP_YEAR ?? "2025";
const BASE = `https://kgp${YEAR}.azurewebsites.net/edb`;
const LIST_URL = (district) => `${BASE}/school.php?lang=en&district=${district}`;
const DETAIL_URL = (id) => `${BASE}/schoolinfo.php?lang=en&schid=${encodeURIComponent(id)}`;
const ALS_URL = (q) => `https://www.als.gov.hk/lookup?q=${encodeURIComponent(q)}&n=1`;

// district ids exactly as the EDB list form spells them
const DISTRICTS = [
  ["central", "Central & Western"],
  ["hkeast", "HK East"],
  ["islands", "Islands"],
  ["southern", "Southern"],
  ["wanchai", "Wan Chai"],
  ["kwaichung", "Kwai Chung & Tsing Yi"],
  ["tsuenwan", "Tsuen Wan"],
  ["tuenmun", "Tuen Mun"],
  ["yuenlong", "Yuen Long"],
  ["north", "North"],
  ["shatin", "Sha Tin"],
  ["taipo", "Tai Po"],
  ["kowlooncity", "Kowloon City"],
  ["kwuntong", "Kwun Tong"],
  ["saikung", "Sai Kung"],
  ["shamshuipo", "Sham Shui Po"],
  ["wongtaisin", "Wong Tai Sin"],
  ["yautsimmongkok", "Yau Tsim & Mong Kok"],
];

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
const onlyArg = process.argv.indexOf("--district");
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null;

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
};

fs.mkdirSync(CACHE, { recursive: true });

// transient network errors must not kill an hour-long run
async function fetchRetry(url, init, attempts = 4) {
  for (let i = 0; ; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (i >= attempts - 1) throw e;
      const wait = 2000 * 2 ** i;
      console.warn(`  … ${e.cause?.code ?? e.message}; retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function fetchText(url, cacheKey) {
  const file = path.join(CACHE, cacheKey);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const res = await fetchRetry(url, {
    headers: { "User-Agent": "Mozilla/5.0 (kindergarten snapshot; one-time)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  await new Promise((r) => setTimeout(r, 400)); // be gentle with the host
  return text;
}

const clean = (s) =>
  (s ?? "")
    .replace(/ |&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ------------------------------------------------------------ title case -- */

const SMALL_WORDS = new Set(["of", "the", "and", "for", "cum"]);
const FORCED = new Map([
  ["twghs", "TWGHs"],
  ["ii", "II"],
  ["iii", "III"],
]);

function titleWord(word, isFirst) {
  const lower = word.toLowerCase();
  if (FORCED.has(lower)) return FORCED.get(lower);
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;
  // capitalize each hyphenated part: ANGLO-CHINESE -> Anglo-Chinese
  return lower
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join("-");
}

function titleCase(name) {
  let first = true;
  return clean(name)
    .split(" ")
    .map((w) => {
      if (!/[a-z]/i.test(w)) return w; // "&", "-", "(", numbers
      if (/\d|\//.test(w)) return w; // unit codes: G/F, G02-G05, 1/F
      const openParen = w.startsWith("(");
      const bare = openParen ? w.slice(1) : w;
      const cased = titleWord(bare, first);
      first = false;
      return openParen ? "(" + cased[0].toUpperCase() + cased.slice(1) : cased;
    })
    .join(" ");
}

/* ------------------------------------------------------------------ list -- */

function parseList(html) {
  const seen = new Map();
  for (const m of html.matchAll(
    /GoSchoolDetail\('(\d+)'\)"\s*>([^<]+)<\/td>/g,
  )) {
    const id = m[1];
    if (seen.has(id)) continue;
    let name = clean(m[2]);
    let formerName = null;
    const past = name.match(/\(Name in the past:\s*([^)]+)\)/i);
    if (past) {
      formerName = titleCase(past[1]);
      name = clean(name.replace(past[0], ""));
    }
    seen.set(id, { id, name: titleCase(name), formerName });
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ area -- */

// Neighbourhood grouping for the list view, derived from the address.
const AREA_RULES = [
  [/Fu Heng Est/i, "Fu Heng Estate"],
  [/Fu Shin Est/i, "Fu Shin Estate"],
  [/Tai Wo Est/i, "Tai Wo Estate"],
  [/Kwong Fuk Est/i, "Kwong Fuk Estate"],
  [/Tai Yuen Est/i, "Tai Yuen Estate"],
  [/Wan Tau Tong Est/i, "Wan Tau Tong Estate"],
  [/Fu Tip Est/i, "Fu Tip Estate"],
  [/Po Nga Court/i, "Po Nga Court"],
  [/Yat Nga Court/i, "Yat Nga Court"],
  [/Sun Hing Garden/i, "Sun Hing Garden"],
  [/Chui Lok Street/i, "Town Centre · Chui Lok Street"],
  [/Hong Lok Yuen/i, "Hong Lok Yuen"],
  [/Constellation Cove|Hung Lam Drive/i, "Constellation Cove"],
  [/Mayfair By the Sea|Fo Chun Road/i, "Pak Shek Kok"],
  [/Education University|Lo Ping Road/i, "EdUHK · Lo Ping Road"],
  [/Ting Kok Road/i, "Ting Kok Road"],
  [/Plover Cove/i, "Plover Cove Road"],
  [/Wan Tau Street|Heung Sze Wui/i, "Tai Po Market"],
  [/Kam Shan Road|Kwong Fuk Road/i, "Kwong Fuk Road"],
];

// Generic extraction for districts without curated rules: named estate/court/
// development first, then "N Street" pattern, then the address's own locality.
const PLACE_RE =
  /([A-Za-z'&.À-ɏ-]+(?: [A-Za-z'&.À-ɏ-]+){0,4}) (Estate|Court|Gardens?|Villas?|Village|Terrace|Centre|Center|Plaza|Square|Bay|Chuen|Tsuen|Toi|House)(?=,|$| )/;
const STREET_RE =
  /\d+[A-Za-z]?[,-]? ([A-Za-z'. À-ɏ-]+? (?:Road|Street|Avenue|Drive|Lane|Path|Crescent|Circuit|Praya|Terrace))(?=,|$| )/;

function lastLocality(address) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const tail = parts.filter(
    (p) => !/^(new territories|kowloon|hong kong|hk|h\.k\.)$/i.test(p),
  );
  return tail.length ? tail[tail.length - 1] : null;
}

function deriveArea(address, districtName) {
  for (const [re, label] of AREA_RULES) if (re.test(address)) return label;
  const place = address.match(PLACE_RE);
  if (place) return `${place[1]} ${place[2]}`;
  const street = address.match(STREET_RE);
  if (street) return street[1];
  return lastLocality(address) ?? districtName;
}

/* ---------------------------------------------------------------- detail -- */

/** All leaf table cells (no nested table inside), cleaned, in document order. */
function cellStream(html) {
  const $ = load(html);
  const cells = [];
  $("td, th").each((_, el) => {
    if ($(el).find("table").length) return;
    const t = clean($(el).text());
    if (t) cells.push(t);
  });
  return cells;
}

const valueAfter = (cells, re) => {
  const i = cells.findIndex((c) => re.test(c));
  return i > -1 && i + 1 < cells.length ? cells[i + 1] : null;
};

const FEE_RE = /^(free|-|–|—|n\.?a\.?|\$[\d,]+(\s*\(\d+\))?)$/i;
const NUM_RE = /^\d+$/;

function parseFeeCell(raw) {
  if (raw == null) return null;
  const t = clean(raw);
  if (/^(-|–|—|n\.?a\.?)$/i.test(t)) return null;
  if (/^free$/i.test(t)) return { text: "Free", annual: 0 };
  const m = t.replace(/,/g, "").match(/^\$(\d+)(?:\s*\((\d+)\))?$/);
  if (!m) return { text: t, annual: null };
  return { text: t, annual: Number(m[1]), instalments: m[2] ? Number(m[2]) : null };
}

/** Read the 3 level values (K1/K2/K3) following each "X Session" row label. */
function sessionTable(cells, anchorRe, valueRe, width) {
  const start = cells.findIndex((c) => anchorRe.test(c));
  if (start === -1) return null;
  const out = {};
  const window = cells.slice(start, start + 45);
  for (const [key, label] of [["am", "AM Session"], ["pm", "PM Session"], ["wd", "WD Session"]]) {
    const i = window.findIndex((c) => c === label);
    if (i === -1) continue;
    const vals = window.slice(i + 1, i + 1 + width);
    if (vals.every((v) => valueRe.test(v))) out[key] = vals;
  }
  return out;
}

/** Collapse the per-level fee cells into one display string + K1 annual number. */
function collapseFees(levels) {
  if (!levels) return { display: null, annual: null };
  const parsed = levels.map(parseFeeCell);
  if (parsed.every((p) => p == null)) return { display: null, annual: null };
  const texts = parsed.map((p) => (p ? p.text : "—"));
  const uniq = [...new Set(texts)];
  let display;
  if (uniq.length === 1) {
    display = uniq[0];
    const inst = parsed.find(Boolean)?.instalments;
    if (inst) display = display.replace(/\s*\(\d+\)$/, ` (${inst} instalments)`);
  } else {
    display = texts.map((t, i) => `K${i + 1} ${t}`).join(" · ");
  }
  const annual = parsed.find((p) => p && p.annual != null)?.annual ?? null;
  return { display, annual };
}

function parseDetail(html, listEntry, districtName) {
  const cells = cellStream(html);
  const id = listEntry.id;

  const school = {
    id,
    name: listEntry.name,
    scheme: false,
    lat: null,
    lng: null,
    address: "",
    area: districtName,
    tel: null,
    fees: { am: null, pm: null, wd: null },
    feesAnnual: { am: null, pm: null, wd: null },
    enrolment: null,
    teacherPupilRatio: null,
    curriculum: null,
    extras: [],
    sourceUrl: DETAIL_URL(id),
  };

  const rawAddress = valueAfter(cells, /^Address:?$/i) ?? "";
  school.address = rawAddress ? titleCase(rawAddress) : "";
  school.area = deriveArea(school.address, districtName);
  if (school.area === districtName && school.address)
    warn(`${id} (${school.name}): no area extracted from "${school.address}"`);
  school.tel = valueAfter(cells, /^Tel\.?:?$/i);

  // Scheme banner: a "Joining" / "Not Joining" cell right before
  // "2025/26 KG Education Scheme"
  const bannerIdx = cells.findIndex((c) => /^2025\/26 KG Education Scheme$/i.test(c));
  if (bannerIdx > 0 && /joining/i.test(cells[bannerIdx - 1])) {
    school.scheme = !/not\s+joining/i.test(cells[bannerIdx - 1]);
  } else {
    warn(`${id} (${school.name}): scheme banner not found`);
  }

  // Annual fees table: sessions × (K1, K2, K3)
  const feeRows = sessionTable(cells, /^Annual Fees \(/i, FEE_RE, 3);
  if (feeRows) {
    for (const key of ["am", "pm", "wd"]) {
      const { display, annual } = collapseFees(feeRows[key]);
      school.fees[key] = display;
      school.feesAnnual[key] = annual;
    }
  } else {
    warn(`${id} (${school.name}): annual fees table not found`);
  }

  // Enrolment table: sessions × (K1, K2, K3, Total) — show the totals
  const enrolRows = sessionTable(cells, /^No\. of Enrolment/i, NUM_RE, 4);
  if (enrolRows) {
    const parts = [];
    for (const [key, label] of [["am", "AM"], ["pm", "PM"], ["wd", "Whole-day"]]) {
      const total = enrolRows[key]?.[3];
      if (total != null && Number(total) > 0) parts.push(`${label} ${total}`);
    }
    school.enrolment = parts.length ? parts.join(" · ") : "0 enrolled (Sept 2024)";
  }

  const ratioAm = valueAfter(cells, /^Teacher to pupil ratio in morning/i);
  const ratioPm = valueAfter(cells, /^Teacher to pupil ratio in afternoon/i);
  const ratios = [];
  if (ratioAm && /\d/.test(ratioAm)) ratios.push(`${clean(ratioAm).replace(/\s/g, "")} AM`);
  if (ratioPm && /\d/.test(ratioPm)) ratios.push(`${clean(ratioPm).replace(/\s/g, "")} PM`);
  school.teacherPupilRatio = ratios.join(" · ") || null;

  const currType = valueAfter(cells, /^Curriculum type$/i);
  const approachIdx = cells.findIndex((c) =>
    /^Learning \/ Teaching approach and activities$/i.test(c),
  );
  const approach = approachIdx > -1 ? cells[approachIdx + 1] : null;
  school.curriculum = currType ? `${currType} curriculum` : null;

  // Curated extras, in a sensible reading order
  const extra = (label, value) => {
    if (value && !/^-$/.test(value)) school.extras.push([label, value]);
  };
  extra("Teaching approach", approach && approach.length > 12 ? approach : null);
  extra("Category", valueAfter(cells, /^School Category$/i));
  extra("Students", valueAfter(cells, /^Student Category$/i));
  extra("Founded", valueAfter(cells, /^School Founding Year$/i));
  extra("Registered classrooms", valueAfter(cells, /^Number of Registered Classrooms$/i));
  extra("Principal & teachers", valueAfter(cells, /^Total No\. of Principal & Teaching Staff/i));
  const qr = valueAfter(cells, /^Quality Review/i);
  extra("Quality review", qr ? clean(qr.replace(/https?:\/\/\S+/g, "")) : null);
  const site = valueAfter(cells, /^School Website$/i);
  extra("Website", site ? site.toLowerCase() : null);
  if (listEntry.formerName) extra("Former name", listEntry.formerName);

  if (!school.address) warn(`${id} (${school.name}): address not found`);
  if (
    school.feesAnnual.am == null &&
    school.feesAnnual.pm == null &&
    school.feesAnnual.wd == null
  )
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
    const res = await fetchRetry(ALS_URL(query), {
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

const DATA_DIR = path.join(ROOT, "public", "data", "kg");
fs.mkdirSync(DATA_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const districtIndex = [];

for (const [districtId, districtName] of DISTRICTS.filter(
  ([id]) => !ONLY || id === ONLY,
)) {
  console.log(`\n═══ ${districtName} (${districtId}) ═══`);
  const listHtml = await fetchText(LIST_URL(districtId), `${YEAR}-${districtId}-list.html`);
  let list = parseList(listHtml);
  if (list.length === 0) {
    warn(`${districtName}: no GoSchoolDetail ids found — inspect the cached list page`);
    continue;
  }
  console.log(`  list: ${list.length} campuses`);
  list = list.slice(0, LIMIT);

  const schools = [];
  for (const entry of list) {
    const html = await fetchText(DETAIL_URL(entry.id), `${YEAR}-${entry.id}.html`);
    schools.push(parseDetail(html, entry, districtName));
  }

  if (!NO_GEOCODE) {
    for (const s of schools) {
      if (!s.address) continue;
      const addr = s.address.toUpperCase();
      const locality = (lastLocality(s.address) ?? districtName).toUpperCase();
      // ALS often rejects shop/floor prefixes; fall back to street, then building
      const queries = [addr];
      const street = addr.match(/(\d+[A-Z]?)\s+([A-Z'. ]+?(?:ROAD|STREET|LANE|AVENUE|DRIVE|CRESCENT|PRAYA|TERRACE))/);
      if (street) queries.push(`${street[1]} ${street[2]} ${locality}`);
      const estate = addr.match(/([A-Z'. ]{3,}?(?:HOUSE|COURT|ESTATE|GARDENS?|CENTRE|PLAZA|VILLA|VILLAGE|TSUEN|CHUEN))(?:,|$)/);
      if (estate) queries.push(`${clean(estate[1])} ${locality}`);
      let geo = null;
      let err = null;
      for (let i = 0; i < queries.length && !geo; i++) {
        try {
          geo = await geocode(queries[i], `${s.id}-${i}`);
        } catch (e) {
          err = e;
        }
      }
      if (geo) Object.assign(s, geo);
      else warn(`${s.id} (${s.name}): geocode failed${err ? ` — ${err.message}` : " (no geometry)"}`);
    }
  }

  fs.writeFileSync(
    path.join(DATA_DIR, `${districtId}.json`),
    JSON.stringify(
      {
        generatedAt,
        profileYear: `${YEAR}/${Number(YEAR.slice(2)) + 1}`,
        source: LIST_URL(districtId),
        district: { id: districtId, name: districtName },
        schools,
      },
      null,
      1,
    ) + "\n",
  );

  const located = schools.filter((s) => s.lat != null);
  districtIndex.push({
    id: districtId,
    name: districtName,
    count: schools.length,
    scheme: schools.filter((s) => s.scheme).length,
    lat: located.length
      ? +(located.reduce((a, s) => a + s.lat, 0) / located.length).toFixed(5)
      : null,
    lng: located.length
      ? +(located.reduce((a, s) => a + s.lng, 0) / located.length).toFixed(5)
      : null,
  });
  console.log(
    `  ✓ ${schools.length} schools (${schools.filter((s) => s.scheme).length} scheme, ${located.length} geocoded)`,
  );
}

fs.writeFileSync(
  path.join(ROOT, "public", "data", "districts.json"),
  JSON.stringify(
    {
      generatedAt,
      profileYear: `${YEAR}/${Number(YEAR.slice(2)) + 1}`,
      districts: districtIndex,
    },
    null,
    1,
  ) + "\n",
);

const total = districtIndex.reduce((a, d) => a + d.count, 0);
console.log(`\nWrote ${districtIndex.length} district files — ${total} schools total.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  console.log("Raw pages are cached in scripts/cache/ for inspection.");
  process.exitCode = 2;
}
