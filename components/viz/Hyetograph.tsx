"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Flag } from "@/lib/model/faults";
import { dayLabel, eat, hhmm } from "@/lib/model/time";
import { STEP_MS, type Report } from "@/lib/model/types";
import { windowSum } from "@/lib/model/bucket";
import { fmtMm } from "@/lib/view";

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const R = 12;
const TOP = 18;

/**
 * Rain per 15 min, hanging from the top axis (hydrology convention). Bars after
 * the playhead are the "future" of the replay, drawn faint.
 */
export function Hyetograph({
  rain,
  start,
  i0,
  i1,
  i,
  flags = [],
  reports = [],
  onSeek,
  height = 180,
  crossingName,
  minimal,
}: {
  rain: ArrayLike<number>;
  start: number;
  i0: number;
  i1: number;
  i: number;
  flags?: Flag[];
  reports?: Report[];
  onSeek?: (i: number) => void;
  height?: number;
  crossingName?: string;
  /** replay strip: no cumulative line, lighter axes */
  minimal?: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const L = minimal ? 26 : 34;
  const BOTTOM = minimal ? 24 : 30;
  const [drag, setDrag] = useState(false);
  const n = i1 - i0 + 1;
  const H = height;
  const bw = W > 0 ? (W - L - R) / n : 0;
  const x = (k: number) => L + (k - i0) * bw;
  const maxR = useMemo(() => {
    let m = 0;
    for (let k = i0; k <= i1; k++) m = Math.max(m, rain[k] || 0);
    return Math.max(6, Math.ceil(m / 4) * 4);
  }, [rain, i0, i1]);
  const depth = H - TOP - BOTTOM;
  const yb = (mm: number) => (Math.min(mm, maxR) / maxR) * depth;
  const cum = useMemo(() => {
    const c: number[] = [];
    let s = 0;
    for (let k = i0; k <= i1; k++) {
      s += rain[k] || 0;
      c.push(s);
    }
    return c;
  }, [rain, i0, i1]);
  const total = cum[cum.length - 1] ?? 0;
  const soFar = cum[Math.min(cum.length - 1, Math.max(0, i - i0))] ?? 0;
  const cy = (s: number) => TOP + (total > 0 ? (s / Math.max(total, 1)) * depth : 0);

  // hour ticks
  const ticks: { k: number; label: string; day?: string }[] = [];
  for (let k = i0; k <= i1; k++) {
    const e = eat(start + k * STEP_MS);
    if (e.mi === 0 && e.h % 3 === 0) ticks.push({ k, label: `${String(e.h).padStart(2, "0")}:00`, day: e.h === 0 ? dayLabel(start + k * STEP_MS).replace(/ \w+$/, "") : undefined });
  }

  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el || bw <= 0) return null;
    const r = el.getBoundingClientRect();
    const k = Math.floor((clientX - r.left - L) / bw) + i0;
    return Math.min(i1, Math.max(i0, k));
  };

  const hk = hover ?? null;
  const cumPath = (from: number, to: number) => {
    let d = "";
    for (let k = from; k <= to; k++) d += `${k === from ? "M" : "L"}${(x(k) + bw).toFixed(1)} ${cy(cum[k - i0]).toFixed(1)}`;
    return d;
  };

  return (
    <div
      ref={ref}
      className="relative w-full touch-none"
      style={{ height: H }}
      onPointerMove={(e) => {
        const k = pick(e.clientX);
        setHover(k);
        if (drag && k != null) onSeek?.(k);
      }}
      onPointerLeave={() => {
        setHover(null);
        setDrag(false);
      }}
      onPointerDown={(e) => {
        const k = pick(e.clientX);
        if (k != null) onSeek?.(k);
        setDrag(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={() => setDrag(false)}
    >
      {W > 0 && (
        <svg width={W} height={H} className="absolute inset-0 block" role="img" aria-label={`Rain per 15 minutes. ${fmtMm(soFar)} mm so far of ${fmtMm(total)} mm in this window.`}>
          <defs>
            <pattern id="hy-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--nocall)" strokeWidth="2.2" strokeOpacity=".45" />
            </pattern>
          </defs>
          {/* depth gridlines (mm per 15 min) */}
          {(minimal ? [0, maxR] : [0, maxR / 2, maxR]).map((mm) => (
            <g key={mm}>
              <line x1={L} x2={W - R} y1={TOP + yb(mm)} y2={TOP + yb(mm)} stroke="var(--line)" strokeOpacity={mm === 0 ? 1 : 0.5} strokeDasharray={mm === 0 ? undefined : "2 3"} />
              <text x={L - 6} y={TOP + yb(mm) + 4} textAnchor="end" className="fill-ink-muted font-mono text-[10.5px] tnum">
                {mm}
              </text>
            </g>
          ))}
          <text x={L - 6} y={11} textAnchor="end" className="fill-ink-muted font-mono text-[10px]">
            mm
          </text>
          {/* gauge faults */}
          {flags.map((f, k) => {
            if (f.kind === "unreliable") return null;
            const a = Math.max(f.i0, i0);
            const b = Math.min(f.i1, i1);
            if (b < a) return null;
            return <rect key={k} x={x(a)} y={TOP} width={Math.max(2, (b - a + 1) * bw)} height={depth} fill="url(#hy-hatch)" />;
          })}
          {/* rain bars hanging from the top */}
          {Array.from({ length: n }, (_, j) => {
            const k = i0 + j;
            const v = rain[k] || 0;
            if (v <= 0) return null;
            const past = k <= i;
            return (
              <rect
                key={k}
                x={x(k) + (bw > 3 ? 0.5 : 0)}
                y={TOP}
                width={Math.max(1, bw - (bw > 3 ? 1 : 0))}
                height={Math.max(1, yb(v))}
                fill="var(--rain)"
                opacity={past ? (k === i ? 1 : 0.85) : 0.22}
              />
            );
          })}
          {/* cumulative rain (right scale) */}
          {total > 0 && !minimal && (
            <>
              <path d={cumPath(i0, Math.min(i, i1))} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
              {i < i1 && <path d={cumPath(Math.max(i0, i), i1)} fill="none" stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1.25} strokeDasharray="3 3" />}
            </>
          )}
          {/* time axis */}
          {ticks.map((t) => (
            <g key={t.k}>
              <line x1={x(t.k)} x2={x(t.k)} y1={H - BOTTOM + 2} y2={H - BOTTOM + 7} stroke="var(--ink-muted)" />
              <text x={x(t.k)} y={H - 6} textAnchor="middle" className="fill-ink-muted font-mono text-[10.5px] tnum">
                {t.day ?? t.label}
              </text>
            </g>
          ))}
          {/* reports */}
          {reports.map((r) => {
            const k = Math.floor((r.t - start) / STEP_MS);
            if (k < i0 || k > i1) return null;
            const col = r.status === "flooded" ? "var(--reroute)" : "var(--cross)";
            const cx = x(k) + bw / 2;
            return <path key={r.id} d={`M${cx} ${H - BOTTOM - 1}l-5 8h10z`} fill={col} stroke="var(--surface-1)" strokeWidth={1} />;
          })}
          {/* playhead */}
          <line x1={x(i) + bw} x2={x(i) + bw} y1={TOP - 6} y2={H - BOTTOM + 2} stroke="var(--ink)" strokeWidth={2} />
          <rect x={x(i) + bw - 3} y={TOP - 8} width={6} height={6} fill="var(--ink)" />
          {hk != null && hk !== i && <line x1={x(hk) + bw / 2} x2={x(hk) + bw / 2} y1={TOP} y2={H - BOTTOM} stroke="var(--ink)" strokeOpacity={0.3} />}
        </svg>
      )}
      <div className="pointer-events-none absolute right-3 top-0 text-right font-mono text-[11px] leading-4 text-ink-muted tnum">
        <span className="text-ink">{fmtMm(soFar)}</span> / {fmtMm(total)} mm{crossingName ? ` · ${crossingName}` : ""}
      </div>
      {hk != null && W > 0 && (
        <div
          className="pointer-events-none absolute z-10 w-max rounded-sm bg-ink px-2 py-1 font-mono text-[11.5px] leading-snug text-canvas tnum shadow-pop"
          style={{ left: Math.min(W - 170, Math.max(0, x(hk) + bw + 8)), top: TOP + 4 }}
        >
          {dayLabel(start + hk * STEP_MS)} {hhmm(start + hk * STEP_MS + STEP_MS)}
          <br />
          {fmtMm(rain[hk] || 0)} mm in 15 min · {fmtMm(windowSum(rain, hk, 12))} mm in 3 h
        </div>
      )}
    </div>
  );
}

/** The whole file at a glance, with the replay window as a brush. */
export function SeriesOverview({
  rain,
  start,
  n,
  i0,
  i1,
  i,
  onJump,
}: {
  rain: ArrayLike<number>;
  start: number;
  n: number;
  i0: number;
  i1: number;
  i: number;
  onJump: (center: number) => void;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 34;
  const bin = 8; // 2-hour bins
  const bins = Math.ceil(n / bin);
  const sums = useMemo(() => {
    const out = new Float64Array(bins);
    for (let k = 0; k < n; k++) out[Math.floor(k / bin)] += rain[k] || 0;
    return out;
  }, [rain, n, bins]);
  const maxS = Math.max(4, ...sums);
  const bx = W / bins;
  const days: { k: number; label: string }[] = [];
  for (let k = 0; k < n; k++) {
    const e = eat(start + k * STEP_MS);
    if (e.h === 0 && e.mi === 0) days.push({ k, label: String(e.d) });
  }
  return (
    <div
      ref={ref}
      className="relative h-[34px] w-full cursor-pointer"
      role="slider"
      aria-label="Whole rain record; click to move the replay window"
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={i}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onJump(Math.round((i0 + i1) / 2) + 96);
        if (e.key === "ArrowLeft") onJump(Math.round((i0 + i1) / 2) - 96);
      }}
      onPointerDown={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onJump(Math.round(((e.clientX - r.left) / r.width) * n));
      }}
    >
      {W > 0 && (
        <svg width={W} height={H} className="block" aria-hidden>
          {Array.from(sums, (s, b) => (s > 0 ? <rect key={b} x={b * bx} y={0} width={Math.max(1, bx - 0.5)} height={Math.max(1, (s / maxS) * (H - 14))} fill="var(--rain)" opacity={0.8} /> : null))}
          {days.map((d) => (
            <g key={d.k}>
              <line x1={(d.k / n) * W} x2={(d.k / n) * W} y1={H - 12} y2={H - 8} stroke="var(--line-strong)" />
              <text x={(d.k / n) * W + 2} y={H - 1} className="fill-ink-muted font-mono text-[9.5px]">
                {d.label}
              </text>
            </g>
          ))}
          <rect x={(i0 / n) * W} y={0.75} width={Math.max(3, ((i1 - i0 + 1) / n) * W)} height={H - 13} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={2} />
          <line x1={((i + 1) / n) * W} x2={((i + 1) / n) * W} y1={0} y2={H - 12} stroke="var(--ink)" strokeWidth={1.5} />
        </svg>
      )}
    </div>
  );
}
