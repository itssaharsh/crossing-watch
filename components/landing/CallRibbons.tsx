"use client";

import { useMemo } from "react";
import { useWidth } from "@/components/viz/Hyetograph";
import { assignGauges } from "@/lib/model/csv";
import { buildModels, type CrossingModel } from "@/lib/model/decide";
import { qc } from "@/lib/model/faults";
import { findStorms, windowFor } from "@/lib/model/storms";
import { eat, hhmm } from "@/lib/model/time";
import { durText } from "@/lib/view";
import { STEP_MS, type Call, type Series } from "@/lib/model/types";
import { BASE_CROSSINGS, SEED_REPORTS, SIMULATED_SOURCE, STATION_SOURCE } from "@/lib/state/store";

const FILL: Record<Call, string> = { cross: "var(--cross)", wait: "var(--wait)", reroute: "var(--reroute)", nocall: "var(--nocall)" };

/** One deterministic world for the landing page: seed reports only, no visitor's taps. */
export function useLandingWorld() {
  return useMemo(() => {
    const src = STATION_SOURCE ?? SIMULATED_SOURCE;
    const series: Series = src.series;
    const clean = qc(series);
    const crossings = assignGauges(BASE_CROSSINGS, series);
    const dataset = src.kind === "demo" ? "simulated" : "station";
    const models = buildModels(series, clean, crossings, SEED_REPORTS.filter((r) => (r.dataset ?? "simulated") === dataset));
    const gid = crossings[0]?.gaugeId ?? series.gauges[0].id;
    const storm = findStorms(clean.rain[gid])[0];
    const w = windowFor(series, storm);
    return { series, clean, models, gid, storm, w, simulated: src.kind === "demo" };
  }, []);
}

const ROWS = [
  { id: "jkuat-culvert", note: "floods first, drains first" },
  { id: "kimbo-matangi", note: "reroute via Theta Road" },
  { id: "murera-drift", note: "a murram drift on the Thiririka" },
  { id: "ndarugu", note: "slow river: up past midnight" },
];

/**
 * The real storm, fifteen minutes at a time: rain hanging from the top, and
 * under it the call each crossing got at every step.
 */
export function CallRibbons() {
  const { series, clean, models, gid, w } = useLandingWorld();
  const [ref, W] = useWidth<HTMLDivElement>();
  const i0 = w.i0;
  const i1 = Math.min(series.n - 1, w.i0 + 48); // 12 hours from two hours before the storm
  const n = i1 - i0 + 1;
  const narrow = W < 640;
  const LABEL = narrow ? 0 : 176;
  const RAIN_H = narrow ? 80 : 118;
  const ROW_H = narrow ? 18 : 30;
  const GAP = narrow ? 26 : 8;
  const rows = ROWS.map((r) => ({ ...r, m: models[r.id] as CrossingModel })).filter((r) => r.m);
  const top = RAIN_H + (narrow ? 34 : 16);
  const H = top + rows.length * (ROW_H + GAP) + 34;
  const cw = W > 0 ? (W - LABEL) / n : 0;
  const x = (k: number) => LABEL + (k - i0) * cw;
  const rain = clean.rain[gid];
  let maxR = 4;
  for (let k = i0; k <= i1; k++) maxR = Math.max(maxR, rain[k] || 0);
  maxR = Math.ceil(maxR / 4) * 4;
  const ticks: number[] = [];
  for (let k = i0; k <= i1; k++) {
    const e = eat(series.start + k * STEP_MS);
    if (e.mi === 0 && e.h % (W < 640 ? 4 : 2) === 0) ticks.push(k);
  }
  // the moment the rider's route turns red
  const km = models["kimbo-matangi"];
  let firstRed = -1;
  for (let k = i0; k <= i1; k++)
    if (km?.calls[k]?.call === "reroute") {
      firstRed = k;
      break;
    }
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Rain at the JKUAT gauge on 20 March 2026, and the call for four crossings every 15 minutes" className="block overflow-visible">
          {/* rain, hanging from the top axis */}
          <line x1={LABEL} x2={W} y1={0.5} y2={0.5} stroke="var(--line)" />
          {Array.from({ length: n }, (_, j) => {
            const k = i0 + j;
            const v = rain[k] || 0;
            if (v <= 0) return null;
            return <rect key={k} x={x(k) + 0.5} y={1} width={Math.max(1, cw - 1)} height={(v / maxR) * RAIN_H} fill="var(--rain)" opacity={0.9} />;
          })}
          {LABEL > 0 && (
            <text x={0} y={16} className="fill-ink-muted text-[13px]">
              Rain every 15 min
              <tspan x={0} dy={18} className="font-mono text-[12px]">
                up to {maxR} mm
              </tspan>
            </text>
          )}
          {/* one ribbon per crossing */}
          {rows.map((r, j) => {
            const y = top + j * (ROW_H + GAP);
            return (
              <g key={r.id}>
                {narrow && (
                  <text x={0} y={y - 6} className="fill-ink text-[12.5px] font-bold">
                    {r.m.crossing.short ?? r.m.crossing.name} <tspan className="fill-ink-muted font-normal">· {r.note}</tspan>
                  </text>
                )}
                {LABEL > 0 && (
                  <>
                    <text x={0} y={y + 13} className="fill-ink text-[14px] font-bold">
                      {r.m.crossing.short ?? r.m.crossing.name}
                    </text>
                    <text x={0} y={y + 28} className="fill-ink-muted text-[12px]">
                      {r.note}
                    </text>
                  </>
                )}
                {/* the call made with reading k holds from the end of step k (its issue time) */}
                {Array.from({ length: n - 1 }, (_, q) => {
                  const k = i0 + q;
                  const c = r.m.calls[k]?.call ?? "cross";
                  return <rect key={k} x={x(k + 1) + 0.5} y={y} width={Math.max(1, cw - 1)} height={ROW_H} fill={FILL[c]} opacity={c === "cross" ? 0.28 : 1} />;
                })}
              </g>
            );
          })}
          {/* the moment Kimbo–Matangi goes red */}
          {firstRed >= 0 && (
            <g>
              {narrow ? (
                rows.map((r, j) => {
                  const y = top + j * (ROW_H + GAP);
                  return <line key={r.id} x1={x(firstRed + 1)} x2={x(firstRed + 1)} y1={y - 3} y2={y + ROW_H + 3} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" />;
                })
              ) : (
                <line x1={x(firstRed + 1)} x2={x(firstRed + 1)} y1={top - 10} y2={top + rows.length * (ROW_H + GAP) - GAP + 6} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" />
              )}
              <text x={x(firstRed + 1) + 8} y={narrow ? RAIN_H + 14 : top - 3} className="fill-ink text-[13px] font-bold">
                {hhmm(series.start + (firstRed + 1) * STEP_MS)} Kimbo–Matangi: reroute, ~{durText(km.calls[firstRed].tClearMin ?? 120, "en")}
              </text>
            </g>
          )}
          {/* time axis */}
          {ticks.map((k) => (
            <text key={k} x={x(k)} y={H - 8} textAnchor="middle" className="fill-ink-muted font-mono text-[11.5px]">
              {hhmm(series.start + k * STEP_MS)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
