import { STEP_MIN } from "./types";

/** Fraction of the bucket left after one step, for a given half-life. */
export function decayFor(halfLifeH: number, stepMin = STEP_MIN): number {
  return Math.pow(0.5, stepMin / 60 / halfLifeH);
}

/**
 * Antecedent precipitation index: a bucket that fills with each step's rain
 * and drains by half every `halfLifeH` hours. S[i] = k·S[i−1] + r[i].
 */
export function bucket(rain: ArrayLike<number>, halfLifeH: number, stepMin = STEP_MIN, s0 = 0): Float64Array {
  const k = decayFor(halfLifeH, stepMin);
  const s = new Float64Array(rain.length);
  let acc = s0;
  for (let i = 0; i < rain.length; i++) {
    acc = acc * k + (rain[i] || 0);
    s[i] = acc;
  }
  return s;
}

/** Sum of rain over the `steps` steps ending at i (inclusive). */
export function windowSum(rain: ArrayLike<number>, i: number, steps: number): number {
  let sum = 0;
  for (let k = Math.max(0, i - steps + 1); k <= i; k++) sum += rain[k] || 0;
  return sum;
}

/**
 * Bucket level at step 0 from rain that fell before the series starts. We only
 * know the total, so it is assumed centred `hoursBefore` hours earlier.
 */
export function warmStart(mm: number, halfLifeH: number, hoursBefore = 9): number {
  return mm * Math.pow(0.5, hoursBefore / halfLifeH);
}
