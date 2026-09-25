/**
 * npm run backtest: a held-out test on a storm the model never saw.
 *
 * Triggers are learned only from the March file and its dated reports, then
 * run over 18–30 Apr 2026 with no reports at all. The Star photographed
 * Kimbo–Matangi Road flooded on 28 Apr "after heavy rains pounded the area
 * last night". The question: did the model call it before that story ran?
 *
 * April rows: the Conduit dashboard export archived in
 * github.com/vinnienovah/Afya-Mazingira (MIT) at commit 37946ea. Its 1,805
 * March rows match data/fixtures/jkuat-conduit-2026-03.csv exactly.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import crossingsJson from "../data/crossings.json";
import seeds from "../data/reports.seed.json";
import stationSeries from "../data/station/series.json";
import { assignGauges, parseStationCsv } from "../lib/model/csv";
import { buildModels, type CrossingModel } from "../lib/model/decide";
import { qc } from "../lib/model/faults";
import { findStorms } from "../lib/model/storms";
import { dayLabel, hhmm, parseEat } from "../lib/model/time";
import { STEP_MS, type Crossing, type Report, type Series } from "../lib/model/types";

const CROSSINGS = (crossingsJson as unknown as { crossings: Crossing[] }).crossings;
const SEEDS = (seeds as unknown as { reports: (Omit<Report, "t" | "until"> & { time: string; until?: string })[] }).reports.map(({ time, until, ...r }) => ({
  ...r,
  t: parseEat(time),
  until: until ? parseEat(until) : undefined,
}));

/** Learn each crossing's trigger on March, then run April with no reports. */
export function heldOut() {
  const march = stationSeries as unknown as Series;
  const marchModels = buildModels(march, qc(march), assignGauges(CROSSINGS, march), SEEDS.filter((r) => r.dataset === "station"));
  const learned = Object.fromEntries(Object.entries(marchModels).map(([id, m]) => [id, m.post]));
  const csv = readFileSync(join(process.cwd(), "data/fixtures/jkuat-conduit-2026-04.csv"), "utf8");
  const { series } = parseStationCsv(csv, "jkuat-conduit-2026-04.csv");
  const clean = qc(series);
  const models = buildModels(series, clean, assignGauges(CROSSINGS, series), [], learned);
  return { series, clean, models, marchModels };
}

/** Each change of call, as "Mon 27 Apr 21:30 REROUTE". Times are the end of the step. */
export function transitions(series: Series, m: CrossingModel, from: number, to: number) {
  const out: { t: number; call: string }[] = [];
  for (let i = 0; i < series.n; i++) {
    const t = series.start + (i + 1) * STEP_MS;
    if (t < from || t > to) continue;
    if (!out.length || out[out.length - 1].call !== m.calls[i].call) out.push({ t, call: m.calls[i].call });
  }
  return out;
}

if (process.argv[1]?.endsWith("backtest.ts")) {
  const { series, clean, models, marchModels } = heldOut();
  const T = (i: number) => series.start + i * STEP_MS;
  const g = series.gauges.find((x) => !x.unreliable) ?? series.gauges[0];
  console.log(`# Held-out test: triggers learned on 6–24 Mar, run on ${dayLabel(T(0))} → ${dayLabel(T(series.n - 1))}, no reports\n`);
  console.log("Storms in April:");
  for (const s of findStorms(clean.rain[g.id])) {
    console.log(`  ${dayLabel(T(s.i0))} ${hhmm(T(s.i0))}–${hhmm(T(s.i1 + 1))}: ${s.total.toFixed(1)} mm`);
  }
  const from = parseEat("2026-04-18T00:00");
  const to = parseEat("2026-05-01T00:00");
  for (const [id, m] of Object.entries(models)) {
    const b = marchModels[id].band;
    console.log(`\n${m.crossing.name}  (trigger learned on March: ${Math.round(b.lo)}–${Math.round(b.hi)} mm)`);
    for (const x of transitions(series, m, from, to)) console.log(`  ${dayLabel(x.t)} ${hhmm(x.t)}  ${x.call.toUpperCase()}`);
  }
}
