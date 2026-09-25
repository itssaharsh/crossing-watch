"use client";

import { motion } from "motion/react";
import { useReduced } from "@/lib/useReduced";
import { useEffect, useRef, useState } from "react";
import geoJson from "@/data/geo/juja.json";
import { GGauge } from "@/components/brand/glyphs";
import { CALL_FILL, cx } from "@/components/ui/primitives";
import type { CrossingModel } from "@/lib/model/decide";
import type { Call, Gauge } from "@/lib/model/types";
import { DepthPost } from "./DepthPost";

interface Geo {
  width: number;
  height: number;
  project: { west: number; north: number; kx: number; scale: number };
  rivers: { name: string; kind: string; d: string }[];
  roads: { name: string; cls: string; unpaved: boolean; d: string }[];
  minor: string;
  places: { name: string; kind: string; x: number; y: number }[];
  attribution: string;
}
const geo = geoJson as unknown as Geo;

export const project = (lon: number, lat: number): [number, number] => [
  (lon - geo.project.west) * geo.project.kx * geo.project.scale,
  (geo.project.north - lat) * geo.project.scale,
];

const ROAD_W: Record<string, number> = { motorway: 3.6, trunk: 3.4, primary: 2.4, secondary: 2, tertiary: 1.7, unclassified: 1.1, residential: 1 };
const ROAD_O: Record<string, number> = { motorway: 0.7, trunk: 0.7, primary: 0.5, secondary: 0.45, tertiary: 0.4, unclassified: 0.22, residential: 0.18 };
/** place labels that would compete with crossing names */
const QUIET_PLACES = new Set(["Gachororo", "Ndarugu", "Theta", "Matangi"]);

/** km → map units at this frame */
const UNITS_PER_KM = geo.project.scale / 111.32;

export interface MapPost {
  id: string;
  label: string;
  call: Call;
  model: CrossingModel;
  level: number;
}

export function CrossingMap({
  posts,
  selectedId,
  onSelect,
  detours = [],
  gauges = [],
  view,
  compact,
  loading,
  legend,
}: {
  posts: MapPost[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** detour paths to draw ([lon, lat]) keyed by crossing id */
  detours?: { id: string; path: [number, number][]; strong?: boolean }[];
  gauges?: Gauge[];
  view?: { x: number; y: number; w: number; h: number };
  compact?: boolean;
  loading?: boolean;
  /** a one-line key to the posts */
  legend?: boolean;
}) {
  const reduce = useReduced();
  const v = view ?? { x: 0, y: 0, w: geo.width, h: geo.height };
  const pct = (X: number, Y: number) => ({ left: `${((X - v.x) / v.w) * 100}%`, top: `${((Y - v.y) / v.h) * 100}%` });
  const inView = (X: number, Y: number) => X >= v.x - 4 && X <= v.x + v.w + 4 && Y >= v.y - 4 && Y <= v.y + v.h + 4;

  // pulse when a crossing turns red (T-02)
  const prev = useRef<Record<string, Call>>({});
  const [pulses, setPulses] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const p of posts) {
      const was = prev.current[p.id];
      if (was && was !== p.call && p.call === "reroute") next[p.id] = Date.now();
      prev.current[p.id] = p.call;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(next).length) setPulses((s) => ({ ...s, ...next }));
  }, [posts]);

  // place labels that would sit on a post are dropped
  const postXY = posts.map((p) => project(p.model.crossing.lon, p.model.crossing.lat));
  const nearPost = (X: number, Y: number) => postXY.some(([px, py]) => Math.abs(px - X) < 70 && Y - py > -52 && Y - py < 16);

  // crossing names go right of their post; left if another post is in the way, below if there's no room left either
  const box = useRef<HTMLDivElement>(null);
  const [pxW, setPxW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const side = (id: string, X: number, Y: number, text: string): "right" | "left" | "below" => {
    if ((X - v.x) / v.w > 0.8) return "left";
    const k = pxW / v.w;
    if (!k) return "right";
    const labelW = text.length * 7.6 + 8;
    const crowded = posts.some((o, j) => {
      if (o.id === id) return false;
      const dx = (postXY[j][0] - X) * k;
      return dx > 0 && dx < labelW + 20 && Math.abs((Y - postXY[j][1]) * k) < 48;
    });
    if (!crowded) return "right";
    return (X - v.x) * k > labelW + 16 ? "left" : "below";
  };

  const scaleKm = 2;
  const barPct = ((scaleKm * UNITS_PER_KM) / v.w) * 100;

  return (
    <div ref={box} className="relative w-full select-none" style={{ aspectRatio: `${v.w} / ${v.h}` }}>
      <svg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMid meet">
        <rect x={v.x} y={v.y} width={v.w} height={v.h} fill="var(--canvas)" />
        {loading ? null : (
          <>
            <path d={geo.minor} fill="none" stroke="var(--ink)" strokeOpacity={0.05} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            {geo.rivers.map((r, k) => (
              <path
                key={k}
                d={r.d}
                fill="none"
                stroke="var(--rain)"
                strokeOpacity={r.name ? 0.7 : 0.22}
                strokeWidth={r.name ? (r.kind === "river" ? 2 : 1.6) : 0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {geo.roads.map((r, k) => (
              <path
                key={k}
                d={r.d}
                fill="none"
                stroke={r.unpaved ? "var(--murram)" : "var(--ink)"}
                strokeOpacity={r.unpaved ? 0.35 : (ROAD_O[r.cls] ?? 0.2)}
                strokeWidth={ROAD_W[r.cls] ?? 1}
                strokeDasharray={r.unpaved ? "3 2" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {detours.map((d) => {
              const pts = d.path.map(([lon, lat]) => project(lon, lat));
              const dd = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");
              return (
                <g key={d.id}>
                  <path d={dd} fill="none" stroke="var(--canvas)" strokeWidth={d.strong ? 8 : 6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <motion.path
                    d={dd}
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth={d.strong ? 5 : 4}
                    strokeOpacity={d.strong ? 1 : 0.55}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    // a fade, not a pathLength draw: dash lengths break under non-scaling strokes and stop the line short
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  />
                  {/* a white core no road has: this is a route, not a road */}
                  <motion.path
                    d={dd}
                    fill="none"
                    stroke="var(--surface-1)"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.9 }}
                  />
                </g>
              );
            })}
          </>
        )}
      </svg>

      {loading && <div className="sk absolute inset-0 opacity-50" />}

      {/* place labels */}
      {!loading &&
        geo.places.map((p) =>
          inView(p.x, p.y) && !nearPost(p.x, p.y) && !QUIET_PLACES.has(p.name) && (p.x - v.x) / v.w > 0.05 && (p.x - v.x) / v.w < 0.95 ? (
            <span
              key={p.name}
              className={cx(
                "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-ink-muted [text-shadow:0_0_2px_var(--canvas),0_0_4px_var(--canvas)]",
                p.kind === "town" ? "label text-[12px] tracking-[0.14em] text-ink" : "text-[12px] font-bold",
                compact && p.kind !== "town" && "hidden",
              )}
              style={pct(p.x, p.y)}
            >
              {p.name}
            </span>
          ) : null,
        )}

      {/* rain gauges */}
      {gauges
        .filter((g) => !g.unreliable)
        .map((g) => {
          const [X, Y] = project(g.lon, g.lat);
          if (!inView(X, Y)) return null;
          return (
            <span
              key={g.id}
              title={g.name}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-sm bg-surface-1/90 px-1 py-0.5 text-[11px] font-bold text-rain shadow-[0_0_0_1px_var(--line)]"
              style={pct(X, Y)}
            >
              <GGauge size={14} />
            </span>
          );
        })}

      {/* crossings: mini depth posts planted on the map */}
      {posts.map((p) => {
        const c = p.model.crossing;
        const [X, Y] = project(c.lon, c.lat);
        const sel = p.id === selectedId;
        if (!inView(X, Y)) return null;
        const text = sel && !compact ? c.name : (c.short ?? c.name);
        const at = side(p.id, X, Y, text);
        const flip = at === "left";
        return (
          <button
            key={p.id}
            onClick={() => onSelect?.(p.id)}
            aria-label={`${c.name}: ${p.label}`}
            aria-pressed={sel}
            className={cx(
              "group absolute flex -translate-y-full items-end gap-1.5 rounded-sm outline-offset-4 transition-opacity duration-150",
              flip ? "-translate-x-[calc(100%-9px)] flex-row-reverse" : "-translate-x-[9px]",
              selectedId && !sel && "opacity-75 hover:opacity-100",
            )}
            style={{ ...pct(X, Y), zIndex: sel ? 3 : p.call === "reroute" ? 2 : 1 }}
          >
            <span className="relative flex flex-col items-center">
              {pulses[p.id] && (
                <span
                  key={pulses[p.id]}
                  aria-hidden
                  className="absolute left-1/2 top-[1px] size-[14px] -translate-x-1/2 rounded-[2px] border-2 [animation:ring_600ms_var(--ease-out)_forwards]"
                  style={{ borderColor: CALL_FILL[p.call] }}
                />
              )}
              <span
                aria-hidden
                className={cx("relative mb-[2px] size-[14px] rounded-[2px] ring-2 ring-ink transition-transform duration-200", sel && "scale-125", p.call === "nocall" && "hatch")}
                style={{ background: p.call === "nocall" ? "var(--surface-2)" : CALL_FILL[p.call] }}
              />
              <DepthPost variant={compact ? "marker" : "map"} level={p.level} band={p.model.band} uncertain={p.model.obs.length === 0} />
            </span>
            <span
              className={cx(
                "whitespace-nowrap rounded-sm px-1 text-[13px] font-bold leading-5 [text-shadow:0_0_2px_var(--canvas),0_0_3px_var(--canvas),0_0_5px_var(--canvas)]",
                at === "below" ? "absolute left-0 top-full mt-1" : "mb-7",
                sel ? "bg-ink text-canvas [text-shadow:none]" : "text-ink group-hover:underline",
              )}
            >
              {text}
            </span>
          </button>
        );
      })}

      {/* scale + attribution */}
      <div className="pointer-events-none absolute bottom-1.5 left-3 flex items-center gap-2 text-[11px] leading-none text-ink-muted" style={{ width: `${barPct}%` }}>
        <span className="h-[5px] w-full border-x-[1.5px] border-b-[1.5px] border-ink/60" />
        <span className="whitespace-nowrap font-mono">{scaleKm} km</span>
      </div>
      {legend && (
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-3 rounded-md bg-canvas px-2.5 py-1.5 text-[12px] text-ink-muted shadow-[0_0_0_1px_var(--line)]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-2 border border-ink bg-rain/80" /> rain in the bucket
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-3 bg-reroute/40 ring-1 ring-reroute/60" /> flood trigger
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="flex h-[5px] w-5 items-center rounded-full bg-ink px-[3px]">
              <span className="h-[1.5px] w-full rounded-full bg-surface-1" />
            </span>{" "}
            detour
          </span>
        </div>
      )}
      <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10.5px] text-ink-muted/90">{geo.attribution}</span>
    </div>
  );
}
