import type { Status } from "./types";

/** Candidate trigger levels, mm in the bucket. */
export const THETA_MIN = 2;
export const THETA_MAX = 150;
export const THETA = Float64Array.from({ length: THETA_MAX - THETA_MIN + 1 }, (_, j) => THETA_MIN + j);

/** Chance a single report is simply wrong (wrong place, stale photo). */
export const REPORT_ERROR = 0.03;

/** Softness of the flood edge: timing and depth are never exact. */
export const tau = (theta: number) => 1.5 + 0.08 * theta;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** P(crossing looks flooded | bucket level s, trigger θ). */
export function pFlood(s: number, theta: number): number {
  return sigmoid((s - theta) / tau(theta));
}

export function prior(median: number, sigma = 0.45): Float64Array {
  const mu = Math.log(median);
  const p = new Float64Array(THETA.length);
  let sum = 0;
  for (let j = 0; j < THETA.length; j++) {
    const z = (Math.log(THETA[j]) - mu) / sigma;
    p[j] = Math.exp(-0.5 * z * z) / THETA[j];
    sum += p[j];
  }
  for (let j = 0; j < p.length; j++) p[j] /= sum;
  return p;
}

export interface Observation {
  level: number;
  status: Status;
  weight: number;
}

/** Bayesian update of the trigger over the θ grid. */
export function posterior(pri: Float64Array, obs: Observation[]): Float64Array {
  const logp = new Float64Array(pri.length);
  for (let j = 0; j < pri.length; j++) logp[j] = Math.log(pri[j] + 1e-300);
  for (const o of obs) {
    for (let j = 0; j < THETA.length; j++) {
      const pf = REPORT_ERROR + (1 - 2 * REPORT_ERROR) * pFlood(o.level, THETA[j]);
      const like = o.status === "flooded" ? pf : 1 - pf;
      logp[j] += o.weight * Math.log(like);
    }
  }
  let max = -Infinity;
  for (let j = 0; j < logp.length; j++) if (logp[j] > max) max = logp[j];
  const post = new Float64Array(pri.length);
  let sum = 0;
  for (let j = 0; j < logp.length; j++) {
    post[j] = Math.exp(logp[j] - max);
    sum += post[j];
  }
  for (let j = 0; j < post.length; j++) post[j] /= sum;
  return post;
}

export interface Band {
  lo: number;
  mid: number;
  hi: number;
}

function quantile(post: Float64Array, q: number): number {
  let c = 0;
  for (let j = 0; j < post.length; j++) {
    const next = c + post[j];
    if (next >= q) {
      // linear interpolation inside the cell
      const f = post[j] > 0 ? (q - c) / post[j] : 0;
      return THETA[j] - 0.5 + f;
    }
    c = next;
  }
  return THETA[THETA.length - 1];
}

/** 10th–90th percentile of the trigger, plus the median. */
export function band(post: Float64Array): Band {
  return { lo: quantile(post, 0.1), mid: quantile(post, 0.5), hi: quantile(post, 0.9) };
}

export const TABLE_STEP = 0.25;
export const TABLE_MAX = 220;

/** P(flooded | level s) tabulated every 0.25 mm, integrating over the trigger posterior. */
export function pTable(post: Float64Array): Float32Array {
  const size = Math.round(TABLE_MAX / TABLE_STEP) + 1;
  const t = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const s = i * TABLE_STEP;
    let p = 0;
    for (let j = 0; j < THETA.length; j++) p += post[j] * pFlood(s, THETA[j]);
    t[i] = p;
  }
  return t;
}

export function pAt(table: Float32Array, s: number): number {
  if (s <= 0) return table[0];
  const x = s / TABLE_STEP;
  const i = Math.floor(x);
  if (i >= table.length - 1) return table[table.length - 1];
  const f = x - i;
  return table[i] * (1 - f) + table[i + 1] * f;
}
