# Kindergartens near Casa Brava · Tai Po

A phone-first static map of **every Tai Po kindergarten on the EDB Kindergarten
Profile 2025/26**, sorted nearest-first from **Casa Brava, Block 23, 73 Ting Kok
Road** (hardcoded home — no address typing).

- Full-screen map (MapLibre GL + OpenFreeMap tiles) with rank-numbered pins:
  **persimmon** = joining the Kindergarten Education Scheme, **outlined slate** =
  not joining. Black house = home.
- Draggable bottom sheet with the nearest-first list; tap a pin or row for
  scheme status, straight-line distance, AM / PM / whole-day annual fees,
  address, then the extra EDB facts (enrolment, teacher–pupil ratio,
  curriculum, telephone, everything else the profile lists).
- **Walk** / **Drive** buttons open real directions in Google Maps from home.
- Filter: All / Joining scheme / Not joining (pins and ranks follow the filter).
- English only. Duplicate school names are kept as separate campuses.

## Data: scrape once, ship a snapshot

The live page never calls EDB — it reads a committed snapshot at
`public/data/schools.json`. The snapshot is produced by a one-shot pipeline:

```
npm install
npm run scrape     # fetch list + ~36 school pages, parse, geocode, write snapshot
npm run build
```

`scripts/scrape.mjs`:

1. fetches `https://kgp2025.azurewebsites.net/edb/school.php?lang=en&district=taipo`
   and collects the `GoSchoolDetail('<id>')` ids;
2. fetches each `schoolinfo.php?lang=en&schid=<id>` page (raw HTML cached in
   `scripts/cache/`, so re-runs don't re-hit the host);
3. parses the profile tables — scheme membership, fees per session, address,
   telephone, enrolment, ratios, curriculum; anything unrecognised is kept
   verbatim in `extras` and listed as a warning;
4. geocodes each address (and Casa Brava itself) with the Hong Kong **Address
   Lookup Service** (`www.als.gov.hk`), converting HK1980 grid → WGS84;
5. writes the snapshot and prints a parse report (non-zero exit on warnings).

> **Status:** the snapshot in this repo has not been generated yet. The
> environment this project was built in has an egress allowlist that blocks
> `kgp2025.azurewebsites.net` (and `www.als.gov.hk`), so `npm run scrape` must
> be run once from a normal machine — or from a Claude Code environment whose
> network policy allows those two hosts. Until then the page shows a
> "snapshot not generated" notice; append **`?demo`** to the URL to preview the
> design with clearly-labelled fake data.
>
> The parser was written against the expected EDB profile markup without being
> able to fetch it; if the first run reports warnings, the raw pages are in
> `scripts/cache/*.html` and the label-matching lives in `parseDetail()` in
> `scripts/scrape.mjs`.

## Develop

```
npm run dev                 # local dev server (use ?demo for sample data)
npm run build               # typecheck + static build into dist/
node scripts/screenshot.mjs # phone-viewport design check (offline-safe)
```

## Deploy

`dist/` is fully static — host it anywhere. A GitHub Pages workflow is included
(`.github/workflows/deploy.yml`, deploys on push to `main`). Map tiles are
fetched by the visitor's browser from OpenFreeMap (no API key); directions open
in Google Maps.

## Home coordinates

`public/data/schools.json → home` currently carries an **estimated** point for
Casa Brava (flagged `"estimated": true`); the scrape pipeline replaces it with
the ALS rooftop coordinate. Distances shown are straight-line (haversine).
