export type Status = "flooded" | "clear";
export type Call = "cross" | "wait" | "reroute" | "nocall";
export type CrossingKind = "culvert" | "drift" | "dip" | "bridge" | "high-bridge";

export const STEP_MIN = 15;
export const STEP_MS = STEP_MIN * 60_000;

export interface Gauge {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** set when the importer finds the gauge can't be trusted (never used to fill or call) */
  unreliable?: string;
}

/** A regular 15-min rain series. Values are mm per step; null = missing. */
export interface Series {
  source: "simulated" | "station";
  label: string;
  /** epoch ms (UTC) of step 0 */
  start: number;
  n: number;
  gauges: Gauge[];
  rain: Record<string, (number | null)[]>;
  /** mm that fell in the hours before step 0 (e.g. a daily total at the first reading) */
  antecedent?: Record<string, number>;
  notes?: string;
}

export interface Detour {
  /** road name shown to riders, e.g. "Kenyatta Road" */
  via: string;
  /** crossing on the detour whose call must be CROSS, if any */
  crossingId?: string;
  extraMin: number;
  /** [lon, lat] polyline for drawing the detour */
  path?: [number, number][];
  km?: number;
  computed?: boolean;
}

export interface Crossing {
  id: string;
  name: string;
  /** short name for map labels */
  short?: string;
  /** one-word tag for the gauge board */
  tag?: string;
  road: string;
  river: string;
  kind: CrossingKind;
  lat: number;
  lon: number;
  gaugeId: string;
  /** hours for the bucket to drain by half */
  halfLifeH: number;
  /** prior median trigger, mm in the bucket */
  priorMedian: number;
  detours: Detour[];
  note?: string;
  located?: string;
  source?: { label: string; url?: string };
}

export type ReportSource = "seed" | "news" | "rider";

export interface Report {
  id: string;
  crossingId: string;
  /** epoch ms */
  t: number;
  /** end of the window when the report only says "at some point between t and until" (e.g. a news story) */
  until?: number;
  status: Status;
  source: ReportSource;
  note?: string;
  url?: string;
  device?: string;
  /** which series the report belongs to; seed reports are tied to one */
  dataset?: "simulated" | "station";
}

export const SOURCE_WEIGHT: Record<ReportSource, number> = {
  seed: 1,
  news: 1,
  rider: 0.8,
};
