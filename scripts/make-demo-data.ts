/**
 * Writes data/demo/series.json: a deterministic, SIMULATED 15-min rain series
 * for two gauges around Juja, 6–24 March 2026 (EAT), shaped like the real
 * station file we expect. Every planted fault is listed in FAULTS so the
 * verify script can check the QC catches it.
 *
 *   npx tsx scripts/make-demo-data.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseEat } from "../lib/model/time";
import { STEP_MS, type Series } from "../lib/model/types";

const OUT = join(process.cwd(), "data/demo/series.json");

// mulberry32: tiny seeded PRNG so the file is identical on every run
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260318);

const START = parseEat("2026-03-06T00:00");
const END = parseEat("2026-03-24T23:45");
const N = (END - START) / STEP_MS + 1;
const idx = (eat: string) => (parseEat(eat) - START) / STEP_MS;

export const GAUGES = [
  { id: "A", name: "Gauge A · Juja", lat: -1.0995, lon: 37.0126 },
  { id: "B", name: "Gauge B · Ruiru", lat: -1.1452, lon: 36.9689 },
];

interface Event {
  at: string; // EAT start
  mm: number[]; // per 15-min step at gauge A
  b?: { shift: number; scale: number } | null; // how gauge B sees it (null = A only)
}

// The storm we replay (Wed 18 Mar), sized to land near the county's "over 80 mm in some areas".
const EVENTS: Event[] = [
  { at: "2026-03-08T14:00", mm: [0.2, 0.6, 0.5, 0.3], b: { shift: 1, scale: 0.8 } },
  { at: "2026-03-10T16:30", mm: [0.4, 1.1, 0.9, 0.5, 0.3], b: { shift: 0, scale: 1.2 } },
  { at: "2026-03-12T20:00", mm: [0.3, 0.4], b: null },
  { at: "2026-03-13T16:15", mm: [0.4, 1.6, 3.8, 5.2, 4.1, 2.9, 2.0, 1.4, 1.0, 0.7, 0.5, 0.3], b: { shift: 1, scale: 1.05 } },
  { at: "2026-03-15T14:00", mm: [1.2, 3.6, 9.4, 13.8, 10.6, 6.2, 3.4, 2.2, 1.6, 1.2, 0.9, 0.7, 0.5, 0.4, 0.3], b: { shift: 2, scale: 0.85 } },
  { at: "2026-03-16T15:00", mm: [0.6, 1.4, 1.2, 0.8], b: { shift: 1, scale: 0.7 } },
  { at: "2026-03-17T13:00", mm: [0.4, 0.8], b: null },
  {
    at: "2026-03-18T15:15",
    mm: [0.6, 1.2, 3.2, 6.4, 9.4, 12.2, 10.4, 8.2, 5.6, 3.8, 2.4, 1.6, 1.1, 1.6, 1.8, 1.2, 0.8, 0.5, 0.4, 0.3, 0.2, 0.2],
    b: { shift: 1, scale: 0.82 },
  },
  { at: "2026-03-20T13:00", mm: [0.8, 1.6, 2.4, 2.2, 1.6, 1.1, 0.8, 0.5], b: { shift: 0, scale: 1.0 } },
  { at: "2026-03-21T18:00", mm: [0.5, 1.2, 1.5, 1.1, 0.7], b: { shift: 0, scale: 0.9 } },
  { at: "2026-03-22T15:30", mm: [0.3, 0.6, 0.4], b: { shift: 1, scale: 1.1 } },
  { at: "2026-03-23T16:30", mm: [0.6, 1.8, 3.9, 4.6, 3.2, 2.2, 1.5, 1.0, 0.6, 0.4], b: { shift: 0, scale: 0.95 } },
  { at: "2026-03-24T14:45", mm: [0.5, 1.0, 1.9, 1.2, 0.6, 0.3], b: { shift: 1, scale: 0.8 } },
];

/** Faults planted on purpose; the QC must find each one. */
export const FAULTS = {
  spikeA: { at: "2026-03-11T03:15", mm: 36.4 }, // single-tip burst, nothing around it
  gapA: { from: "2026-03-19T01:00", steps: 3 }, // logger offline 45 min (B covers it)
  flatlineB: { from: "2026-03-20T12:45", to: "2026-03-20T16:15" }, // clogged funnel while A logs 11 mm
  silentBoth: { from: "2026-03-23T17:15", steps: 3 }, // telemetry outage during a storm → NO CALL
};

const q = (x: number) => Math.round(x * 10) / 10; // 0.1 mm resolution
const jitter = () => 0.9 + rand() * 0.2;

function build(): Series {
  const a: (number | null)[] = new Array(N).fill(0);
  const b: (number | null)[] = new Array(N).fill(0);
  for (const e of EVENTS) {
    const i0 = idx(e.at);
    e.mm.forEach((v, k) => {
      const ia = i0 + k;
      if (ia >= 0 && ia < N) a[ia] = q((a[ia] as number) + v * jitter());
      if (e.b) {
        const ib = ia + e.b.shift;
        if (ib >= 0 && ib < N) b[ib] = q((b[ib] as number) + v * e.b.scale * jitter());
      }
    });
  }
  // plant faults
  a[idx(FAULTS.spikeA.at)] = FAULTS.spikeA.mm;
  for (let k = 0; k < FAULTS.gapA.steps; k++) a[idx(FAULTS.gapA.from) + k] = null;
  for (let i = idx(FAULTS.flatlineB.from); i <= idx(FAULTS.flatlineB.to); i++) b[i] = 0;
  for (let k = 0; k < FAULTS.silentBoth.steps; k++) {
    a[idx(FAULTS.silentBoth.from) + k] = null;
    b[idx(FAULTS.silentBoth.from) + k] = null;
  }
  return {
    source: "simulated",
    label: "Simulated gauge series",
    start: START,
    n: N,
    gauges: GAUGES,
    rain: { A: a, B: b },
    notes: "Simulated 15-min series shaped like a March storm in Juja. Replace with the station CSV.",
  };
}

const series = build();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(series));
const total = (id: string) => series.rain[id].reduce<number>((s, v) => s + (v ?? 0), 0);
console.log(`wrote ${OUT}: ${series.n} steps, A ${total("A").toFixed(1)} mm, B ${total("B").toFixed(1)} mm`);
