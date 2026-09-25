import Papa from "papaparse";
import { EAT_OFFSET_MS } from "./time";
import { STEP_MS, type Crossing, type Gauge, type Series } from "./types";

export class ImportError extends Error {}

export interface ImportResult {
  series: Series;
  notes: string[];
}

const TIME_RE = /^(ts|date_?time|timestamp|time|date|datetime|obs_?time|time_?utc|utc|period)$/i;
const TIME_LOOSE = /time|date/i;
const RAIN_RE = /precip|rain|rainfall|^pr$|^rr$|mm/i;
const STATION_RE = /^(station|station_?id|station_?code|site|gauge|code|stn)$/i;
const VAR_RE = /^(variable|var|parameter|param|element)$/i;
const VALUE_RE = /^(value|val|reading|quantity)$/i;
const QUALITY_RE = /quality|qc_?flag|flag$/i;
/** JHUB Conduit station export: running daily totals per gauge (rg1tt, rg2tt), reset at ~09:00 EAT */
const DAILY_TOTAL_RE = /^(rg\d+)tt$/i;

/** Known gauge locations; unknown station codes default to Juja. */
const KNOWN: Record<string, { name: string; lat: number; lon: number }> = {};
const JUJA = { lat: -1.0967, lon: 37.0144 };
/** JKUAT campus, where the JHUB Conduit station stands (approximate) */
const JKUAT = { lat: -1.0968, lon: 37.0149 };

function parseTime(raw: string, assumeUtc: boolean): number {
  const s = raw.trim();
  if (!s) return NaN;
  if (/^\d{10,13}$/.test(s)) return s.length === 13 ? +s : +s * 1000;
  // ISO with zone
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) && /\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s.replace(" ", "T"));
    if (!Number.isNaN(t)) return t;
  }
  let y: number, mo: number, d: number, h = 0, mi = 0, se = 0;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (m[4]) [h, mi, se] = [+m[4], +m[5], +(m[6] ?? 0)];
  } else {
    // dd/mm/yyyy hh:mm (Kenyan spreadsheet exports)
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (!m) return NaN;
    [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (m[4]) [h, mi, se] = [+m[4], +m[5], +(m[6] ?? 0)];
  }
  const utc = Date.UTC(y, mo - 1, d, h, mi, se);
  return assumeUtc ? utc : utc - EAT_OFFSET_MS;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s || s === "-" || /^(nan|null|na|n\/a)$/i.test(s)) return null;
  const x = Number(s);
  if (!Number.isFinite(x) || x < 0) return null;
  return x;
}

function isCumulative(vals: (number | null)[]): boolean {
  const xs = vals.filter((v): v is number => v != null);
  if (xs.length < 12) return false;
  let up = 0;
  let down = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] >= xs[i - 1]) up++;
    else down++;
  }
  const range = xs[xs.length - 1] - xs[0];
  return down / (up + down) < 0.01 && range > 0 && xs.filter((x) => x === 0).length < xs.length * 0.2;
}

function toIncrements(vals: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  let last: number | null = null;
  for (const v of vals) {
    if (v == null) {
      out.push(null);
      continue;
    }
    if (last == null) out.push(0);
    else out.push(v >= last ? v - last : v); // counter reset
    last = v;
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/** Parse a station CSV of unknown shape into a regular 15-min series. */
export function parseStationCsv(text: string, fileName = "file"): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, dynamicTyping: false });
  const fields = (parsed.meta.fields ?? []).map((f) => f.trim());
  if (!fields.length || !parsed.data.length) throw new ImportError(`Couldn't read ${fileName}: the file is empty.`);
  const notes: string[] = [];

  const timeCol = fields.find((f) => TIME_RE.test(f)) ?? fields.find((f) => TIME_LOOSE.test(f));
  if (!timeCol) throw new ImportError(`Couldn't read ${fileName}: no time column found. Expected a timestamp and a rain (mm) column.`);
  const assumeUtc = /utc/i.test(timeCol) || parsed.data.slice(0, 20).some((r) => /[zZ]$|[+-]\d{2}:?\d{2}$/.test(String(r[timeCol] ?? "")));
  if (!assumeUtc) notes.push("Times without a zone were read as EAT (UTC+3).");

  const dailyTotals = fields.filter((f) => DAILY_TOTAL_RE.test(f));
  if (dailyTotals.length) return parseDailyTotals(parsed.data, timeCol, dailyTotals, assumeUtc, fileName, notes);

  const stationCol = fields.find((f) => STATION_RE.test(f));
  const varCol = fields.find((f) => VAR_RE.test(f));
  const valueCol = fields.find((f) => VALUE_RE.test(f));
  const rainCol = fields.find((f) => f !== timeCol && RAIN_RE.test(f));

  // Collect (gauge, t, v) triples
  const rows: { g: string; t: number; v: number | null }[] = [];
  if (varCol && valueCol) {
    // long format: time, station, variable, value
    for (const r of parsed.data) {
      if (!/^pr$|precip|rain/i.test(String(r[varCol] ?? ""))) continue;
      rows.push({ g: stationCol ? String(r[stationCol]).trim() : "gauge", t: parseTime(String(r[timeCol] ?? ""), assumeUtc), v: num(r[valueCol]) });
    }
  } else if (rainCol) {
    const qCol = fields.find((f) => f !== rainCol && QUALITY_RE.test(f));
    let bad = 0;
    for (const r of parsed.data) {
      const flagged = qCol != null && Number(r[qCol]) === -1;
      if (flagged) bad++;
      rows.push({ g: stationCol ? String(r[stationCol]).trim() || "gauge" : "gauge", t: parseTime(String(r[timeCol] ?? ""), assumeUtc), v: flagged ? null : num(r[rainCol]) });
    }
    if (bad) notes.push(`${bad} readings marked bad by the station's quality flag were treated as missing.`);
  } else {
    // wide format: one numeric column per station
    const numeric = fields.filter((f) => f !== timeCol && parsed.data.slice(0, 50).some((r) => num(r[f]) != null));
    if (!numeric.length) throw new ImportError(`Couldn't read ${fileName}: no rain column found (looked for precip, rain, pr, mm).`);
    for (const r of parsed.data) {
      const t = parseTime(String(r[timeCol] ?? ""), assumeUtc);
      for (const f of numeric) rows.push({ g: f, t, v: num(r[f]) });
    }
    notes.push(`Read ${numeric.length} station column${numeric.length > 1 ? "s" : ""}: ${numeric.join(", ")}.`);
  }

  const good = rows.filter((r) => Number.isFinite(r.t));
  if (!good.length) throw new ImportError(`Couldn't read ${fileName}: none of the times in "${timeCol}" could be parsed.`);
  if (good.length < rows.length) notes.push(`${rows.length - good.length} rows had unreadable times and were skipped.`);

  const byGauge = new Map<string, { t: number; v: number | null }[]>();
  for (const r of good) {
    if (!byGauge.has(r.g)) byGauge.set(r.g, []);
    byGauge.get(r.g)!.push({ t: r.t, v: r.v });
  }

  let t0 = Infinity;
  let t1 = -Infinity;
  for (const list of byGauge.values()) {
    list.sort((a, b) => a.t - b.t);
    t0 = Math.min(t0, list[0].t);
    t1 = Math.max(t1, list[list.length - 1].t);
  }
  const start = Math.floor(t0 / STEP_MS) * STEP_MS;
  const n = Math.floor((t1 - start) / STEP_MS) + 1;
  if (n > 200_000) throw new ImportError(`Couldn't read ${fileName}: the time range is too long (${Math.round(n / 96)} days).`);

  const gauges: Gauge[] = [];
  const rain: Record<string, (number | null)[]> = {};
  for (const [g, list0] of byGauge) {
    let list = list0;
    const vals = list.map((x) => x.v);
    if (isCumulative(vals)) {
      const inc = toIncrements(vals);
      list = list.map((x, i) => ({ t: x.t, v: inc[i] }));
      notes.push(`${g}: values were a running total; converted to rain per interval.`);
    }
    const res = median(list.slice(1).map((x, i) => x.t - list[i].t).filter((d) => d > 0));
    const out: (number | null)[] = new Array(n).fill(null);
    if (res >= 3600_000 - 1) {
      // hourly (or coarser): spread evenly over the covered 15-min steps
      const parts = Math.round(res / STEP_MS);
      for (const x of list) {
        if (x.v == null) continue;
        for (let k = 0; k < parts; k++) {
          const i = Math.floor((x.t - start) / STEP_MS) - k;
          if (i >= 0 && i < n) out[i] = (out[i] ?? 0) + x.v / parts;
        }
      }
      notes.push(`${g}: readings are every ${Math.round(res / 60_000)} min; spread evenly over 15-min steps.`);
    } else {
      // sum finer readings into 15-min bins (a reading at 17:15 closes the 17:00–17:15 bin)
      const endAligned = list.filter((x) => new Date(x.t).getUTCMinutes() % 15 === 0).length > list.length * 0.5;
      for (const x of list) {
        const i = Math.floor((x.t - start - (endAligned && res < STEP_MS ? 1 : 0)) / STEP_MS);
        if (i < 0 || i >= n) continue;
        if (x.v == null) continue;
        out[i] = (out[i] ?? 0) + x.v;
      }
      if (res && res !== STEP_MS) notes.push(`${g}: ${Math.round(res / 60_000)}-min readings summed into 15-min steps.`);
    }
    const known = KNOWN[g];
    gauges.push({ id: g, name: known?.name ?? g, lat: known?.lat ?? JUJA.lat, lon: known?.lon ?? JUJA.lon });
    rain[g] = out.map((v) => (v == null ? null : Math.round(v * 100) / 100));
  }

  const ids = gauges.map((g) => g.id);
  return {
    series: {
      source: "station",
      label: `Station data · ${ids.length > 2 ? `${ids.length} gauges` : ids.join(", ")}`,
      start,
      n,
      gauges,
      rain,
      notes: `Imported from ${fileName}`,
    },
    notes,
  };
}

/** Point each crossing at a trusted gauge that exists in this series (nearest by location). */
export function assignGauges(crossings: Crossing[], series: Series): Crossing[] {
  const trusted = series.gauges.filter((g) => !g.unreliable);
  const pool = trusted.length ? trusted : series.gauges;
  const has = new Set(pool.map((g) => g.id));
  return crossings.map((c) => {
    if (has.has(c.gaugeId)) return c;
    let best = pool[0]?.id ?? c.gaugeId;
    let bestD = Infinity;
    for (const g of pool) {
      const d = Math.hypot(g.lat - c.lat, g.lon - c.lon);
      if (d < bestD) {
        bestD = d;
        best = g.id;
      }
    }
    return { ...c, gaugeId: best };
  });
}

/**
 * Spreads rain that fell between two readings over the 15-min steps that interval
 * overlaps. Handles loggers whose clocks drift off the quarter hour.
 */
function spreadIntervals(intervals: { a: number; b: number; mm: number }[], start: number, n: number): (number | null)[] {
  const out: (number | null)[] = new Array(n).fill(null);
  for (const { a, b, mm } of intervals) {
    if (b <= a) continue;
    for (let i = Math.max(0, Math.floor((a - start) / STEP_MS)); i < n; i++) {
      const s0 = start + i * STEP_MS;
      const s1 = s0 + STEP_MS;
      if (s0 >= b) break;
      const ov = Math.min(b, s1) - Math.max(a, s0);
      if (ov <= 0) continue;
      out[i] = (out[i] ?? 0) + (mm * ov) / (b - a);
    }
  }
  return out.map((v) => (v == null ? null : Math.round(v * 100) / 100));
}

function parseDailyTotals(
  data: Record<string, string>[],
  timeCol: string,
  totals: string[],
  assumeUtc: boolean,
  fileName: string,
  notes: string[],
): ImportResult {
  const rows = data
    .map((r) => ({ t: parseTime(String(r[timeCol] ?? ""), assumeUtc), r }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  if (rows.length < 2) throw new ImportError(`Couldn't read ${fileName}: fewer than two readings.`);
  const dts = rows.slice(1).map((x, i) => x.t - rows[i].t);
  const typical = median(dts);
  const start = Math.floor(rows[0].t / STEP_MS) * STEP_MS;
  const n = Math.floor((rows[rows.length - 1].t - start) / STEP_MS) + 1;
  const gauges: Gauge[] = [];
  const rain: Record<string, (number | null)[]> = {};
  const antecedent: Record<string, number> = {};
  for (const col of totals) {
    const id = DAILY_TOTAL_RE.exec(col)![1].toLowerCase();
    const intervals: { a: number; b: number; mm: number }[] = [];
    let resets = 0;
    let backwards = 0;
    for (let k = 1; k < rows.length; k++) {
      const prev = num(rows[k - 1].r[col]);
      const cur = num(rows[k].r[col]);
      if (prev == null || cur == null) continue;
      const b = rows[k].t;
      // a long silence is a gap: only credit the last typical interval
      const a = b - rows[k - 1].t > 2.5 * typical ? b - typical : rows[k - 1].t;
      let mm = cur - prev;
      if (mm < 0) {
        const eatHour = new Date(b + EAT_OFFSET_MS).getUTCHours() + new Date(b + EAT_OFFSET_MS).getUTCMinutes() / 60;
        if (eatHour >= 8.5 && eatHour <= 9.75) {
          mm = cur; // the daily reset at ~09:00 EAT: count what fell since
          resets++;
        } else {
          mm = 0; // a rain total can't go down: sensor fault
          backwards++;
        }
      }
      intervals.push({ a, b, mm });
    }
    const unreliable =
      backwards > Math.max(5, rows.length * 0.01)
        ? `Its daily total went backwards ${backwards} times (it rises in daylight and falls at night), so it isn't measuring rain.`
        : undefined;
    const first = num(rows[0].r[col]);
    if (first && first > 0 && !unreliable) antecedent[id] = first;
    rain[id] = spreadIntervals(intervals, start, n);
    gauges.push({ id, name: `JKUAT gauge ${id.replace(/\D/g, "")}`, lat: JKUAT.lat, lon: JKUAT.lon, unreliable });
    notes.push(
      unreliable
        ? `${id}: ignored. ${unreliable}`
        : `${id}: rain taken from the running daily total ${col} (${resets} daily resets), not the ${id} column.`,
    );
  }
  if (Object.keys(antecedent).length) {
    notes.push(
      `Rain before the file starts: ${Object.entries(antecedent)
        .map(([g, mm]) => `${g} ${mm} mm`)
        .join(", ")} since the last 09:00 reset. Counted as antecedent rain in each bucket.`,
    );
  }
  return {
    series: {
      source: "station",
      label: `Station data · JKUAT ${gauges.filter((g) => !g.unreliable).map((g) => g.id).join(" + ")}`,
      start,
      n,
      gauges,
      rain,
      antecedent,
      notes: `Imported from ${fileName}`,
    },
    notes,
  };
}
