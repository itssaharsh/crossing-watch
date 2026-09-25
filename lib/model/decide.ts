import { bucket, decayFor, warmStart, windowSum } from "./bucket";
import type { CleanSeries } from "./faults";
import { band, pAt, posterior, prior, pTable, type Band, type Observation } from "./trigger";
import { SOURCE_WEIGHT, STEP_MIN, STEP_MS, type Call, type Crossing, type Report, type Series } from "./types";

export const P_FLOODED = 0.6;
export const P_MAYBE = 0.3;
export const P_CLEARED = 0.5;
/** projection horizon for "clears in…", steps */
export const HORIZON = 48;
/** look-ahead for "may flood by…", steps */
export const FLOOD_LOOKAHEAD = 8;
export const RECENT_REPORT_MIN = 30;
export const DETOUR_MARGIN_MIN = 10;
/** unknown rain in the last N steps → no call */
export const SILENT_STEPS = 2;

export type Reason =
  | "clear"
  | "rising"
  | "maybe_rising"
  | "maybe_falling"
  | "flooded_for"
  | "clears_at"
  | "reported"
  | "gauge_silent";

export interface StepCall {
  call: Call;
  reason: Reason;
  /** P(flooded) now */
  p: number;
  /** bucket level, mm */
  level: number;
  /** minutes until projected P drops below 0.5; null if not flooded; Infinity if beyond horizon */
  tClearMin: number | null;
  /** minutes until projected P reaches 0.6 (within 2 h); null otherwise */
  tFloodMin: number | null;
  detourIdx: number | null;
  reportAgoMin: number | null;
}

export interface ObsRef extends Observation {
  reportId: string;
  i: number;
}

export interface CrossingModel {
  crossing: Crossing;
  rain: Float64Array;
  level: Float64Array;
  p: Float32Array;
  post: Float64Array;
  table: Float32Array;
  band: Band;
  priorBand: Band;
  obs: ObsRef[];
  calls: StepCall[];
  nStorms: number;
}

export const SEVERITY: Record<Call, number> = { cross: 0, wait: 1, reroute: 2, nocall: 3 };

export function stepOf(series: Pick<Series, "start" | "n">, t: number): number {
  return Math.floor((t - series.start) / STEP_MS);
}

/** Nowcast: the last 30 min's rain rate eases off with a 40-min half-life (typical of convective cells). */
export const NOWCAST_HALF_LIFE_MIN = 30;
export function nowcast(rain: ArrayLike<number>, i: number, steps = HORIZON): Float64Array {
  const rate = windowSum(rain, i, 2) / 2;
  const f = Math.pow(0.5, STEP_MIN / NOWCAST_HALF_LIFE_MIN);
  const out = new Float64Array(steps);
  let r = rate;
  for (let k = 0; k < steps; k++) {
    r *= f;
    out[k] = r < 0.05 ? 0 : r;
  }
  return out;
}

function countStorms(ts: number[]): number {
  if (!ts.length) return 0;
  const s = [...ts].sort((a, b) => a - b);
  let n = 1;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > 12 * 3600_000) n++;
  return n;
}

interface Prepared {
  crossing: Crossing;
  rain: Float64Array;
  unknown: Uint8Array;
  level: Float64Array;
  post: Float64Array;
  table: Float32Array;
  p: Float32Array;
  obs: ObsRef[];
  priorBand: Band;
  nStorms: number;
}

function prepare(series: Series, clean: CleanSeries, c: Crossing, reports: Report[]): Prepared {
  const gid = clean.rain[c.gaugeId] ? c.gaugeId : series.gauges[0]?.id;
  const rain = clean.rain[gid] ?? new Float64Array(series.n);
  const unknown = clean.unknown[gid] ?? new Uint8Array(series.n);
  const s0 = series.antecedent?.[gid] ? warmStart(series.antecedent[gid], c.halfLifeH) : 0;
  const level = bucket(rain, c.halfLifeH, undefined, s0);
  const obs: ObsRef[] = [];
  const mine = reports.filter((r) => r.crossingId === c.id);
  for (const r of mine) {
    let i = stepOf(series, r.t);
    if (r.until != null) {
      // "flooded at some point in this window" → the highest level in it; "clear" → the lowest
      const a = Math.max(0, i);
      const b = Math.min(series.n - 1, stepOf(series, r.until));
      if (b < a) continue;
      let best = a;
      for (let k = a; k <= b; k++) {
        if (r.status === "flooded" ? level[k] > level[best] : level[k] < level[best]) best = k;
      }
      i = best;
    }
    if (i < 0 || i >= series.n) continue;
    obs.push({ reportId: r.id, i, level: level[i], status: r.status, weight: SOURCE_WEIGHT[r.source] ?? 0.8 });
  }
  const pri = prior(c.priorMedian);
  const post = posterior(pri, obs);
  const table = pTable(post);
  const p = new Float32Array(series.n);
  for (let i = 0; i < series.n; i++) p[i] = pAt(table, level[i]);
  return {
    crossing: c,
    rain,
    unknown,
    level,
    post,
    table,
    p,
    obs,
    priorBand: band(pri),
    nStorms: countStorms(obs.map((o) => series.start + o.i * STEP_MS)),
  };
}

function project(pr: Prepared, i: number) {
  const fc = nowcast(pr.rain, i);
  const k = decayFor(pr.crossing.halfLifeH);
  let s = pr.level[i];
  let tClear: number | null = null;
  let tFlood: number | null = null;
  const floodedNow = pr.p[i] >= P_FLOODED;
  for (let step = 1; step <= HORIZON; step++) {
    s = s * k + fc[step - 1];
    const p = pAt(pr.table, s);
    if (floodedNow && tClear == null && p < P_CLEARED) tClear = step * STEP_MIN;
    if (!floodedNow && tFlood == null && step <= FLOOD_LOOKAHEAD && p >= P_FLOODED) tFlood = step * STEP_MIN;
  }
  return { tClear: floodedNow ? (tClear ?? Infinity) : null, tFlood };
}

function recentFloodReport(series: Series, reports: Report[], crossingId: string, i: number): number | null {
  const t = series.start + i * STEP_MS + STEP_MS - 1;
  let latest: Report | null = null;
  for (const r of reports) {
    if (r.crossingId !== crossingId || r.t > t || t - r.t > RECENT_REPORT_MIN * 60_000) continue;
    if (!latest || r.t > latest.t) latest = r;
  }
  if (!latest || latest.status !== "flooded") return null;
  return Math.max(0, Math.round((t - latest.t) / 60_000));
}

function rawCall(series: Series, pr: Prepared, all: Record<string, Prepared>, reports: Report[], i: number): StepCall {
  const base = {
    p: pr.p[i],
    level: pr.level[i],
    tClearMin: null as number | null,
    tFloodMin: null as number | null,
    detourIdx: null as number | null,
    reportAgoMin: recentFloodReport(series, reports, pr.crossing.id, i),
  };
  for (let k = Math.max(0, i - SILENT_STEPS + 1); k <= i; k++) {
    if (pr.unknown[k]) return { ...base, call: "nocall", reason: "gauge_silent" };
  }
  const { tClear, tFlood } = project(pr, i);
  base.tClearMin = tClear;
  base.tFloodMin = tFlood;
  const p = pr.p[i];

  if (p >= P_FLOODED) {
    const detours = pr.crossing.detours;
    for (let d = 0; d < detours.length; d++) {
      const det = detours[d];
      const other = det.crossingId ? all[det.crossingId] : undefined;
      const detourClear = other ? other.p[i] < P_MAYBE && !other.unknown[i] : true;
      if (detourClear && (tClear ?? 0) > det.extraMin + DETOUR_MARGIN_MIN) {
        return { ...base, call: "reroute", reason: "flooded_for", detourIdx: d };
      }
    }
    return { ...base, call: "wait", reason: "clears_at" };
  }
  if (p >= P_MAYBE) {
    const rising = i > 0 && pr.level[i] > pr.level[i - 1] + 0.05;
    return { ...base, call: "wait", reason: rising ? "maybe_rising" : "maybe_falling" };
  }
  if (base.reportAgoMin != null) return { ...base, call: "wait", reason: "reported" };
  if (tFlood != null && tFlood <= 60) return { ...base, call: "cross", reason: "rising" };
  return { ...base, call: "cross", reason: "clear" };
}

/** Improving calls must hold for 2 steps before the sign changes. */
export function applyHysteresis(raw: StepCall[]): StepCall[] {
  const out: StepCall[] = new Array(raw.length);
  let shown: StepCall | null = null;
  let pending = 0;
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!shown || r.call === "nocall" || shown.call === "nocall" || SEVERITY[r.call] >= SEVERITY[shown.call]) {
      shown = r;
      pending = 0;
    } else {
      pending++;
      if (pending >= 2) {
        shown = r;
        pending = 0;
      } else {
        // hold the previous call, but keep live numbers
        shown = { ...r, call: shown.call, reason: shown.reason, detourIdx: shown.detourIdx, tClearMin: r.tClearMin ?? shown.tClearMin };
      }
    }
    out[i] = shown;
  }
  return out;
}

export function buildModels(series: Series, clean: CleanSeries, crossings: Crossing[], reports: Report[]): Record<string, CrossingModel> {
  const prepared: Record<string, Prepared> = {};
  for (const c of crossings) prepared[c.id] = prepare(series, clean, c, reports);
  const models: Record<string, CrossingModel> = {};
  for (const c of crossings) {
    const pr = prepared[c.id];
    const raw: StepCall[] = new Array(series.n);
    for (let i = 0; i < series.n; i++) raw[i] = rawCall(series, pr, prepared, reports, i);
    models[c.id] = {
      crossing: c,
      rain: pr.rain,
      level: pr.level,
      p: pr.p,
      post: pr.post,
      table: pr.table,
      band: band(pr.post),
      priorBand: pr.priorBand,
      obs: pr.obs,
      calls: applyHysteresis(raw),
      nStorms: pr.nStorms,
    };
  }
  return models;
}

/** Rounds minutes the way a rider would say them: 5-min steps under an hour, half hours above. */
export function humanDuration(min: number): { value: number; unit: "min" | "h" } {
  if (!Number.isFinite(min)) return { value: 12, unit: "h" };
  if (min < 60) return { value: Math.max(5, Math.round(min / 5) * 5), unit: "min" };
  return { value: Math.round((min / 60) * 2) / 2, unit: "h" };
}
