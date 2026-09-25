/**
 * Turns a station CSV into data/station/series.json, which then becomes the
 * default series (the "Station data" chip). Accepts the JHUB Conduit export
 * (rg1tt/rg2tt running daily totals), TAHMO exports, or any time + rain CSV.
 *
 *   npx tsx scripts/ingest.ts data/fixtures/jkuat-conduit-2026-03.csv
 *   npx tsx scripts/ingest.ts --clear     # back to the simulated series
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseStationCsv } from "../lib/model/csv";
import { qc } from "../lib/model/faults";
import { findStorms } from "../lib/model/storms";
import { dayLabel, hhmm } from "../lib/model/time";
import { STEP_MS } from "../lib/model/types";

const OUT = join(process.cwd(), "data/station/series.json");
const arg = process.argv[2];
if (!arg) {
  console.error("usage: npx tsx scripts/ingest.ts <file.csv> | --clear");
  process.exit(1);
}
if (arg === "--clear") {
  writeFileSync(OUT, "null\n");
  console.log("cleared: the app will use the simulated series");
  process.exit(0);
}
const { series, notes } = parseStationCsv(readFileSync(arg, "utf8"), basename(arg));
writeFileSync(OUT, JSON.stringify(series));
const clean = qc(series);
const g = series.gauges.find((x) => !x.unreliable) ?? series.gauges[0];
const T = (i: number) => series.start + i * STEP_MS;
console.log(`wrote ${OUT}\n  ${series.label}\n  ${dayLabel(T(0))} ${hhmm(T(0))} → ${dayLabel(T(series.n - 1))} ${hhmm(T(series.n - 1))} (${series.n} steps)`);
for (const n of notes) console.log("  note:", n);
console.log(`  flags: ${clean.flags.map((f) => `${f.gaugeId} ${f.kind}`).join(", ") || "none"}`);
for (const s of findStorms(clean.rain[g.id]).slice(0, 4)) {
  console.log(`  storm ${dayLabel(T(s.i0))} ${hhmm(T(s.i0))}–${hhmm(T(s.i1))}: ${s.total.toFixed(1)} mm, peak ${s.peak.toFixed(1)} mm/15 min at ${hhmm(T(s.peakI))}`);
}
