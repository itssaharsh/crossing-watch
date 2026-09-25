"use client";

import { motion } from "motion/react";
import { useReduced } from "@/lib/useReduced";
import { useId } from "react";
import type { Status } from "@/lib/model/types";

export const POST_MAX = 80; // mm; one scale for every post so they can be compared

export interface PostTick {
  id: string;
  level: number;
  status: Status;
  fresh?: boolean;
}

export interface DepthPostProps {
  level: number;
  band: { lo: number; mid: number; hi: number };
  ticks?: PostTick[];
  variant?: "marker" | "map" | "compact" | "large";
  /** prior-only: no reports yet */
  uncertain?: boolean;
  /** gauge fault: water level unknown */
  stale?: boolean;
  max?: number;
  title?: string;
}

const SIZES = {
  marker: { w: 12, h: 38, pad: 4, stroke: 1.5, band: 10 },
  map: { w: 14, h: 54, pad: 5, stroke: 1.5, band: 10 },
  compact: { w: 24, h: 148, pad: 7, stroke: 1.5, band: 10 },
  large: { w: 40, h: 188, pad: 10, stroke: 2, band: 10 },
};

/**
 * The painted depth post beside a drift. Water (bucket level) rises inside it;
 * the learned trigger is the red band; reports are notches on the left edge.
 */
export function DepthPost({ level, band, ticks = [], variant = "compact", uncertain, stale, max = POST_MAX, title }: DepthPostProps) {
  const z = SIZES[variant];
  const reduce = useReduced();
  const clipId = useId();
  const hatchId = useId();
  const W = z.w + z.pad * 2;
  const H = z.h + 2;
  // rounded: server (Node) and browser maths can differ in the last digits
  const y = (mm: number) => Math.round((1 + z.h - (Math.min(Math.max(mm, 0), max) / max) * z.h) * 100) / 100;
  const x0 = z.pad;
  const bands = Math.floor(max / z.band);
  const lvlY = y(level);
  const hiY = y(band.hi);
  const loY = y(band.lo);
  const over = band.hi > max;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, visualDuration: 0.4, bounce: 0 };
  const tween = reduce ? { duration: 0 } : { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const };

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title ?? `Bucket ${Math.round(level)} mm; floods between ${Math.round(band.lo)} and ${Math.round(band.hi)} mm`} className="block overflow-visible">
      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={1} width={z.w} height={z.h} />
        </clipPath>
        <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="var(--surface-2)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--nocall)" strokeWidth="2" />
        </pattern>
      </defs>
      {/* painted bands */}
      <g clipPath={`url(#${clipId})`}>
        {Array.from({ length: bands }, (_, k) => (
          <rect key={k} x={x0} y={y((k + 1) * z.band)} width={z.w} height={z.h / bands} fill={k % 2 ? "var(--surface-1)" : "var(--ink)"} opacity={k % 2 ? 1 : 0.82} />
        ))}
        {/* water */}
        <motion.rect
          x={x0}
          width={z.w}
          initial={false}
          animate={{ y: stale ? 1 : lvlY, height: stale ? z.h : 1 + z.h - lvlY }}
          transition={tween}
          fill={stale ? `url(#${hatchId})` : "var(--rain)"}
          opacity={stale ? 0.9 : 0.88}
        />
        {!stale && (
          <motion.rect x={x0} width={z.w} height={variant === "marker" ? 1 : 2} initial={false} animate={{ y: lvlY }} transition={tween} fill="var(--surface-1)" opacity={0.7} />
        )}
      </g>
      {/* learned trigger band (10–90%), overhanging the post like a painted mark */}
      <motion.rect
        x={x0 - 3}
        width={z.w + 6}
        initial={false}
        animate={{ y: hiY, height: Math.max(2, loY - hiY) }}
        transition={spring}
        fill="var(--reroute)"
        fillOpacity={0.24}
        stroke={uncertain ? "var(--reroute-text)" : "none"}
        strokeDasharray={uncertain ? "3 2" : undefined}
        strokeWidth={1}
      />
      <motion.line
        x1={x0 - 3}
        x2={x0 + z.w + 3}
        initial={false}
        animate={{ y1: y(band.mid), y2: y(band.mid) }}
        transition={spring}
        stroke="var(--reroute)"
        strokeWidth={variant === "marker" ? 1.5 : 2}
      />
      {over && variant !== "marker" && variant !== "map" && <path d={`M${x0 + z.w / 2 - 4} 5l4-4 4 4`} fill="none" stroke="var(--reroute-text)" strokeWidth={1.5} />}
      {/* post outline */}
      <rect x={x0} y={1} width={z.w} height={z.h} fill="none" stroke="var(--ink)" strokeWidth={z.stroke} />
      {/* report notches on the left edge */}
      {variant !== "marker" &&
        variant !== "map" &&
        ticks.map((t) => {
          const ty = y(t.level);
          const col = t.status === "flooded" ? "var(--reroute)" : "var(--cross)";
          return (
            <g key={t.id}>
              <motion.path
                d={`M${x0 - 1} ${ty}l-${z.pad - 1} -3.5v7z`}
                fill={col}
                stroke="var(--canvas)"
                strokeWidth={0.75}
                initial={reduce ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                style={{ originX: `${x0}px`, originY: `${ty}px` }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
              {t.fresh && <circle cx={x0 - z.pad / 2 - 1} cy={ty} r={5.5} fill="none" stroke={col} strokeWidth={1.5} />}
            </g>
          );
        })}
    </svg>
  );
}
