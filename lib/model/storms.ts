import { STEP_MS, type Series } from "./types";

export interface Storm {
  i0: number;
  i1: number;
  total: number;
  peak: number;
  peakI: number;
}

/**
 * Finds rain events: runs of wet steps joined across dry spells shorter than
 * `gapSteps`, keeping events with at least `minTotal` mm. Sorted by total, desc.
 */
export function findStorms(rain: ArrayLike<number>, { gapSteps = 8, minTotal = 8 } = {}): Storm[] {
  const out: Storm[] = [];
  let cur: Storm | null = null;
  let dry = 0;
  for (let i = 0; i < rain.length; i++) {
    const v = rain[i] || 0;
    if (v > 0.1) {
      if (!cur) cur = { i0: i, i1: i, total: 0, peak: 0, peakI: i };
      cur.i1 = i;
      cur.total += v;
      if (v > cur.peak) {
        cur.peak = v;
        cur.peakI = i;
      }
      dry = 0;
    } else if (cur) {
      dry++;
      if (dry > gapSteps) {
        if (cur.total >= minTotal) out.push(cur);
        cur = null;
        dry = 0;
      }
    }
  }
  if (cur && cur.total >= minTotal) out.push(cur);
  return out.sort((a, b) => b.total - a.total);
}

/** Replay window around a storm: from 2 h before it starts to 6 h after it ends (at least 10 h). */
export function windowFor(series: Pick<Series, "n">, storm: Storm | undefined): { i0: number; i1: number } {
  if (!storm) return { i0: 0, i1: Math.min(series.n - 1, 47) };
  const i0 = Math.max(0, storm.i0 - 8);
  const i1 = Math.min(series.n - 1, Math.max(storm.i1 + 24, i0 + 39));
  return { i0, i1 };
}

export const stepTime = (series: Pick<Series, "start">, i: number) => series.start + i * STEP_MS;
