import type { Gauge, Series } from "./types";

export type FlagKind = "gap" | "spike" | "flatline" | "stuck" | "unreliable";

export interface Flag {
  gaugeId: string;
  kind: FlagKind;
  /** first and last step index, inclusive */
  i0: number;
  i1: number;
  /** raw value(s) involved, for the data health list */
  value?: number;
  filledFrom?: string;
}

export interface CleanSeries {
  rain: Record<string, Float64Array>;
  flags: Flag[];
  /** 1 where the value is unknown and could not be filled */
  unknown: Record<string, Uint8Array>;
  /** 1 where the value was replaced (fault) */
  suspect: Record<string, Uint8Array>;
}

export const QC = {
  spikeIsolated: 15, // mm in one step with dry steps either side
  spikeAbsolute: 50, // mm in one step, always suspicious
  flatlineSteps: 8, // 2 h of zeros…
  flatlineNeighbourMm: 10, // …while the neighbour logged at least this much
  stuckSteps: 6,
  stuckMin: 1, // tipping buckets legitimately repeat 0.2 mm in drizzle
} as const;

function dist(a: Gauge, b: Gauge) {
  const dx = (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dy = a.lat - b.lat;
  return Math.hypot(dx, dy);
}

export function neighbourOf(series: Series, gaugeId: string): string | undefined {
  const g = series.gauges.find((x) => x.id === gaugeId);
  if (!g) return undefined;
  let best: string | undefined;
  let bestD = Infinity;
  for (const o of series.gauges) {
    if (o.id === gaugeId || o.unreliable) continue;
    const d = dist(g, o);
    if (d < bestD) {
      bestD = d;
      best = o.id;
    }
  }
  return best;
}

/**
 * Quality-controls every gauge. Faulty or missing values are filled from the
 * nearest other gauge where possible, and every intervention is flagged so the
 * UI can show it.
 */
export function qc(series: Series): CleanSeries {
  const { n } = series;
  const rain: Record<string, Float64Array> = {};
  const unknown: Record<string, Uint8Array> = {};
  const suspect: Record<string, Uint8Array> = {};
  const flags: Flag[] = [];

  for (const g of series.gauges) {
    const raw = series.rain[g.id] ?? [];
    if (g.unreliable) {
      // keep the raw values for the health view, but never trust them
      const out = new Float64Array(n);
      for (let i = 0; i < n; i++) out[i] = raw[i] ?? 0;
      rain[g.id] = out;
      unknown[g.id] = new Uint8Array(n).fill(1);
      suspect[g.id] = new Uint8Array(n).fill(1);
      flags.push({ gaugeId: g.id, kind: "unreliable", i0: 0, i1: n - 1 });
      continue;
    }
    const nbId = neighbourOf(series, g.id);
    const nb = nbId ? series.rain[nbId] : undefined;
    const nbAt = (i: number) => (nb ? nb[i] : null);
    const out = new Float64Array(n);
    const unk = new Uint8Array(n);
    const sus = new Uint8Array(n);
    const at = (i: number) => (i >= 0 && i < n ? raw[i] : null);

    // 1. gaps
    for (let i = 0; i < n; ) {
      if (at(i) == null) {
        let j = i;
        while (j + 1 < n && at(j + 1) == null) j++;
        let filled = true;
        for (let k = i; k <= j; k++) {
          const v = nbAt(k);
          if (v == null) {
            filled = false;
            unk[k] = 1;
            out[k] = 0;
          } else out[k] = v;
          sus[k] = 1;
        }
        flags.push({ gaugeId: g.id, kind: "gap", i0: i, i1: j, filledFrom: filled ? nbId : undefined });
        i = j + 1;
      } else {
        out[i] = at(i)!;
        i++;
      }
    }

    // 2. spikes
    for (let i = 0; i < n; i++) {
      const v = at(i);
      if (v == null) continue;
      const prev = at(i - 1) ?? 0;
      const next = at(i + 1) ?? 0;
      const nbv = nbAt(i) ?? 0;
      const isolated = v >= QC.spikeIsolated && prev < 0.5 && next < 0.5 && nbv < 2;
      if (isolated || v > QC.spikeAbsolute) {
        const fill = nbAt(i);
        out[i] = fill ?? 0;
        sus[i] = 1;
        flags.push({ gaugeId: g.id, kind: "spike", i0: i, i1: i, value: v, filledFrom: fill != null ? nbId : undefined });
      }
    }

    // 3. flatline: this gauge reads zero through a wet episode at the neighbour
    if (nb) {
      for (let i = 0; i < n; ) {
        if (at(i) === 0) {
          let j = i;
          while (j + 1 < n && at(j + 1) === 0) j++;
          if (j - i + 1 >= QC.flatlineSteps) {
            // split the zero run into the neighbour's wet episodes (dry gaps of up to 2 steps allowed)
            for (let a = i; a <= j; ) {
              if ((nbAt(a) ?? 0) <= 0) {
                a++;
                continue;
              }
              let b = a;
              let dry = 0;
              let sum = 0;
              for (let k = a; k <= j; k++) {
                const v = nbAt(k) ?? 0;
                if (v > 0) {
                  b = k;
                  dry = 0;
                  sum += v;
                } else if (++dry > 2) break;
              }
              if (sum >= QC.flatlineNeighbourMm && b - a + 1 >= 4) {
                for (let k = a; k <= b; k++) {
                  out[k] = nbAt(k) ?? 0;
                  sus[k] = 1;
                }
                flags.push({ gaugeId: g.id, kind: "flatline", i0: a, i1: b, value: round1(sum), filledFrom: nbId });
              }
              a = b + 1;
            }
          }
          i = j + 1;
        } else i++;
      }
    }

    // 4. stuck: the same non-zero value repeated
    for (let i = 0; i < n; ) {
      const v = at(i);
      if (v != null && v >= QC.stuckMin) {
        let j = i;
        while (j + 1 < n && at(j + 1) === v) j++;
        if (j - i + 1 >= QC.stuckSteps) {
          for (let k = i; k <= j; k++) {
            const fill = nbAt(k);
            if (fill != null) out[k] = fill;
            sus[k] = 1;
          }
          flags.push({ gaugeId: g.id, kind: "stuck", i0: i, i1: j, value: v, filledFrom: nb ? nbId : undefined });
        }
        i = j + 1;
      } else i++;
    }

    rain[g.id] = out;
    unknown[g.id] = unk;
    suspect[g.id] = sus;
  }

  flags.sort((a, b) => a.i0 - b.i0);
  return { rain, flags, unknown, suspect };
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}
