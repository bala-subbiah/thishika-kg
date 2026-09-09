# HK Kindergarten Map

A map of all **953 kindergartens across the 18 Hong Kong districts** from the **EDB
Kindergarten Profile 2025/26**, with per-district data and a movable home pin
(default **Casa Brava, Tai Po**).

- Full-screen map (MapLibre GL + OpenFreeMap tiles): **blue** pins = joining
  the Kindergarten Education Scheme, **outlined grey** = not joining. Movable
  house pin marks home.
- First-visit welcome: geolocate position or browse by district. District bubbles
  appear when zoomed out.
- Desktop: master–detail layout with map and side panel. Mobile: bottom sheet
  with the nearest-first list.
- Tap a pin or row for scheme status, straight-line distance, AM / PM / whole-day
  annual fees, address, enrolment, teacher–pupil ratio, curriculum, and
  telephone.
- **Walk** / **Drive** buttons open directions in Google Maps from home. Shortlist
  with shareable links. Filter: All / Joining scheme / Not joining.
- Keyboard accessible. English only. Duplicate school names are kept as separate
  campuses.

## Data: snapshots by district

The live page reads committed snapshots at `public/data/kg/{district}.json` (18
files) and metadata at `public/data/districts.json`. Each district file holds
`{district, schools:[{name, address, area, fees, enrolment, ...}]}` for all
kindergartens in that district, ready to display.

To refresh for an annual profile update or scrape new districts:

```
npm install
npm run scrape --district taipo     # fetch and parse one district; --limit 5 for testing
npm run scrape --district all       # scrape all 18 districts (sets KGP_YEAR=2025)
KGP_YEAR=2026 npm run scrape        # override profile year for future updates
npm run build
```

`scripts/scrape.mjs`:

1. fetches `https://kgp2025.azurewebsites.net/edb/school.php?lang=en&district=<id>`
   and collects the `GoSchoolDetail('<id>')` ids;
2. fetches each `schoolinfo.php?lang=en&schid=<id>` page (raw HTML cached in
   `scripts/cache/`, so re-runs don't re-hit the host);
3. parses the profile tables — scheme membership, fees per session, address,
   telephone, enrolment, ratios, curriculum; anything unrecognised is kept
   verbatim in `extras` and listed as a warning;
4. geocodes each address with the Hong Kong **Address Lookup Service**
   (`www.als.gov.hk`), converting HK1980 grid → WGS84;
5. writes per-district snapshots to `public/data/kg/` and prints a parse
   report (non-zero exit on warnings).

> All 18 districts have been scraped into `public/data/kg/*.json`. When the EDB
> Kindergarten Profile year changes, re-run `npm run scrape --district all` and
> set `KGP_YEAR` to update all files and the home coordinate for Casa Brava.

## Develop

```
npm run dev                 # local dev server
npm run build               # typecheck + static build into dist/
node scripts/screenshot.mjs # phone-viewport design check (offline-safe)
```

## Deploy

`dist/` is fully static — host it anywhere. A GitHub Pages workflow is included
(`.github/workflows/deploy.yml`, deploys on push to `main`). Map tiles are
fetched by the visitor's browser from OpenFreeMap (no API key); directions open
in Google Maps.

## Home pin

The home pin defaults to **Casa Brava, Tai Po** (coordinates geocoded by the
scrape pipeline via the Hong Kong Address Lookup Service). Users can drag the
pin to any address on the map. Distances shown are straight-line (haversine).
