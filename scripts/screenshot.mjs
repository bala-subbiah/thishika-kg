#!/usr/bin/env node
/**
 * Design-check screenshots at a phone viewport, using the ?demo dataset.
 * Offline-friendly: the basemap style is stubbed with a flat background and
 * webfonts are skipped, so this works in sandboxes with no egress.
 *
 *   node scripts/screenshot.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:4173";
const out = process.argv[3] ?? "scripts/cache";

const STUB_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#e8e4da" } }],
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
if (process.env.OFFLINE) {
  await page.route("**/tiles.openfreemap.org/**", (r) =>
    r.fulfill({ contentType: "application/json", body: STUB_STYLE }),
  );
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await page.route("**/fonts.gstatic.com/**", (r) => r.abort());
}

await page.goto(`${base}/${process.env.DEMO ? "?demo" : ""}`, {
  waitUntil: "networkidle",
});
await page.waitForSelector(".pin", { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/1-list-half.png` });

await page.click(".row >> nth=0");
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/2-detail.png` });

await page.click(".back");
await page.waitForTimeout(300);
await page.click(".chip >> nth=1"); // Joining scheme
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/3-filter-joining.png` });

await browser.close();
console.log(`Screenshots written to ${out}/`);
