/**
 * npm run verify: replays the demo scenario headless and checks the calls a
 * judge will see, on the real JKUAT data and on the simulated fallback.
 * No network, no keys. Exit code 1 if anything fails.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import crossingsJson from "../data/crossings.json";
import demoSeries from "../data/demo/series.json";
import seeds from "../data/reports.seed.json";
import stationSeries from "../data/station/series.json";
import { assignGauges, parseStationCsv } from "../lib/model/csv";
import { buildModels } from "../lib/model/decide";
import { qc } from "../lib/model/faults";
import { findStorms } from "../lib/model/storms";
import { parseEat } from "../lib/model/time";
import { STEP_MS, type Call, type Crossing, type Report, type Series } from "../lib/model/types";
import { heldOut, transitions } from "./backtest";

let failed = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const CROSSINGS = (crossingsJson as unknown as { crossings: Crossing[] }).crossings;
const SEEDS = (seeds as unknown as { reports: (Omit<Report, "t" | "until"> & { time: string; until?: string })[] }).reports.map(({ time, until, ...r }) => ({
  ...r,
  t: parseEat(time),
  until: until ? parseEat(until) : undefined,
}));

function world(series: Series, dataset: "station" | "simulated", extra: Report[] = []) {
  const crossings = assignGauges(CROSSINGS, series);
  const clean = qc(series);
  const models = buildModels(series, clean, crossings, [...SEEDS.filter((r) => r.dataset === dataset), ...extra]);
  const at = (id: string, eatTime: string) => {
    const i = Math.floor((parseEat(eatTime) - series.start) / STEP_MS) - 1; // the step that ends at eatTime
    return models[id].calls[i];
  };
  const range = (id: string, from: string, to: string) => {
    const a = Math.floor((parseEat(from) - series.start) / STEP_MS);
    const b = Math.floor((parseEat(to) - series.start) / STEP_MS);
    return models[id].calls.slice(a, b + 1).map((c, k) => ({ ...c, i: a + k }));
  };
  const firstTime = (id: string, from: string, to: string, pred: (c: Call) => boolean) => {
    const r = range(id, from, to).find((c) => pred(c.call));
    return r ? series.start + (r.i + 1) * STEP_MS : null;
  };
  return { crossings, clean, models, at, range, firstTime };
}
const hm = (t: number | null) => (t == null ? "never" : new Date(t + 3 * 3600_000).toISOString().slice(11, 16));

// ---------- real station data ----------
console.log("\n# JKUAT station data (6–24 Mar 2026)");
if (!stationSeries) {
  check(false, "data/station/series.json exists", "run: npx tsx scripts/ingest.ts data/fixtures/jkuat-conduit-2026-03.csv");
} else {
  const S = stationSeries as unknown as Series;
  const W = world(S, "station");
  const rg1 = W.clean.rain.rg1.reduce((a, v) => a + v, 0);
  check(S.gauges.some((g) => g.id === "rg2" && g.unreliable), "faulty gauge rg2 is ignored");
  check(rg1 > 170 && rg1 < 190, "rain read from the daily total, not the 17×-too-small rg1 column", `${rg1.toFixed(1)} mm`);
  const storm = findStorms(W.clean.rain.rg1)[0];
  check(hm(S.start + storm.i0 * STEP_MS) === "17:15", "biggest storm starts Fri 20 Mar 17:15", `${storm.total.toFixed(1)} mm`);

  const km1800 = W.at("kimbo-matangi", "2026-03-20T18:00");
  const via = km1800.detourIdx != null ? W.crossings.find((c) => c.id === "kimbo-matangi")!.detours[km1800.detourIdx].via : "";
  check(km1800.call === "reroute" && via === "Kenyatta Road", "18:00 Kimbo–Matangi: REROUTE via Kenyatta Road", `${km1800.call} via ${via || "-"}`);
  const dur = (km1800.tClearMin ?? 0) / 60;
  check(dur >= 1.5 && dur <= 2.5, "…and says it clears in about 2 h", `${dur.toFixed(2)} h`);
  check(W.range("kimbo-matangi", "2026-03-20T15:00", "2026-03-20T17:15").every((c) => c.call === "cross"), "Kimbo–Matangi is CROSS before the storm");
  const kmClear = W.firstTime("kimbo-matangi", "2026-03-20T18:15", "2026-03-21T02:00", (c) => c === "cross");
  check(kmClear != null && kmClear <= parseEat("2026-03-20T21:30"), "Kimbo–Matangi back to CROSS by 21:30", hm(kmClear));
  check(W.range("theta-bridge", "2026-03-20T15:00", "2026-03-20T23:00").every((c) => c.call === "cross"), "Theta bridge (the detour) stays CROSS all evening");
  const jkuatClear = W.firstTime("jkuat-culvert", "2026-03-20T18:00", "2026-03-21T02:00", (c) => c === "cross");
  check(jkuatClear != null && kmClear != null && jkuatClear < kmClear, "the flashy JKUAT culvert clears before Kimbo–Matangi", `${hm(jkuatClear)} vs ${hm(kmClear)}`);
  const ndClear = W.firstTime("ndarugu", "2026-03-20T18:00", "2026-03-21T06:00", (c) => c === "cross");
  check(ndClear != null && kmClear != null && ndClear - kmClear >= 3 * 3600_000, "the slow Ndarugu river stays up 3 h+ longer", `${hm(ndClear)} vs ${hm(kmClear)}`);

  // the signature: one tap tightens the band and turns an unsure WAIT into a clear call
  const before = W.models.ndarugu.band;
  const tap: Report = { id: "tap", crossingId: "ndarugu", t: parseEat("2026-03-20T19:30") - 1000, status: "flooded", source: "rider" };
  const W2 = world(S, "station", [tap]);
  const after = W2.models.ndarugu.band;
  const narrower = 1 - (after.hi - after.lo) / (before.hi - before.lo);
  check(narrower >= 0.3, "a rider's Flooded tap at Ndarugu narrows its trigger band", `${before.lo.toFixed(0)}–${before.hi.toFixed(0)} → ${after.lo.toFixed(0)}–${after.hi.toFixed(0)} mm, ${(narrower * 100).toFixed(0)}% narrower`);
  check(W.at("ndarugu", "2026-03-20T20:00").call === "wait" && W2.at("ndarugu", "2026-03-20T20:00").call !== "cross" && W2.at("ndarugu", "2026-03-20T20:00").p > W.at("ndarugu", "2026-03-20T20:00").p + 0.2, "…and raises its flood chance by 20+ points", `${(W.at("ndarugu", "2026-03-20T20:00").p * 100).toFixed(0)}% → ${(W2.at("ndarugu", "2026-03-20T20:00").p * 100).toFixed(0)}%, ${W.at("ndarugu", "2026-03-20T20:00").call} → ${W2.at("ndarugu", "2026-03-20T20:00").call}`);
}

// ---------- simulated fallback ----------
console.log("\n# Simulated series (fallback when no station file)");
{
  const S = demoSeries as unknown as Series;
  const W = world(S, "simulated");
  const kinds = W.clean.flags.map((f) => `${f.gaugeId} ${f.kind}`);
  for (const k of ["A spike", "A gap", "B flatline", "B gap"]) check(kinds.includes(k), `planted fault caught: ${k}`);
  const km = W.firstTime("kimbo-matangi", "2026-03-18T15:00", "2026-03-18T22:00", (c) => c === "reroute");
  check(km != null && km >= parseEat("2026-03-18T16:15") && km <= parseEat("2026-03-18T17:30"), "Wed 18 Mar: Kimbo–Matangi goes REROUTE between 16:15 and 17:30", hm(km));
  const outage = W.range("kimbo-matangi", "2026-03-23T17:15", "2026-03-23T17:45");
  check(outage.every((c) => c.call === "nocall"), "no CROSS while both gauges are silent (23 Mar outage)");
}

// ---------- held-out storm ----------
console.log("\n# Held-out: 27 Apr storm, triggers learned on March only, no reports");
{
  const { series, models } = heldOut();
  const km = models["kimbo-matangi"];
  const firstReroute = (from: string, to: string) =>
    transitions(series, km, parseEat(from), parseEat(to)).find((x) => x.call === "reroute")?.t ?? null;
  const night = firstReroute("2026-04-27T21:00", "2026-04-28T06:00");
  check(night != null, "Kimbo–Matangi goes REROUTE on the night of 27 Apr, before The Star's 28 Apr story", hm(night));
  const before = firstReroute("2026-04-18T00:00", "2026-04-27T21:00");
  // No check after 04:15 on 28 Apr: the road stayed flooded while the model said CROSS (a stated limitation).
  check(before == null, "…and not on the two small storms before it (21 and 26 Apr, none reported)");
}

// ---------- import ----------
console.log("\n# Import");
{
  const csv = readFileSync(join(process.cwd(), "data/fixtures/jkuat-conduit-2026-03.csv"), "utf8");
  const { series } = parseStationCsv(csv, "jkuat.csv");
  check(series.n === 1824, "station CSV → 1,824 steps of 15 min (6–24 Mar)", `${series.n}`);
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
