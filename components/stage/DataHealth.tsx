"use client";

import { GGauge } from "@/components/brand/glyphs";
import type { Flag } from "@/lib/model/faults";
import { dayLabel, hhmm } from "@/lib/model/time";
import { STEP_MS } from "@/lib/model/types";
import { useStore } from "@/lib/state/store";

const FLAG_TEXT: Record<Flag["kind"], string> = {
  gap: "No readings",
  spike: "Implausible spike",
  flatline: "Read zero while the other gauge had rain",
  stuck: "Same value repeated",
  unreliable: "Gauge ignored",
};

export function DataHealth() {
  const s = useStore();
  const T = (i: number) => s.series.start + i * STEP_MS;
  const notes = s.source.notes ?? [];
  const gaugeName = (id: string) => s.series.gauges.find((g) => g.id === id)?.name ?? id;
  const unreliable = s.series.gauges.filter((g) => g.unreliable);
  return (
    <div className="text-[13px] leading-snug">
      <ul className="divide-y divide-line">
        {s.source.kind === "station" && (
          <li className="flex gap-2 py-2">
            <GGauge size={16} className="mt-[2px] shrink-0 text-rain" />
            <span>
              <b>rg1 rain column under-reports ~17×.</b> We read rain from the gauge&rsquo;s running daily total (rg1tt), which resets at 09:00 EAT.
            </span>
          </li>
        )}
        {unreliable.map((g) => (
          <li key={g.id} className="flex gap-2 py-2">
            <span className="hatch mt-[3px] size-3 shrink-0 rounded-[2px] ring-1 ring-nocall" />
            <span>
              <b>{gaugeName(g.id)} ignored.</b> {g.unreliable}
            </span>
          </li>
        ))}
        {s.series.antecedent &&
          Object.entries(s.series.antecedent).map(([g, mm]) => (
            <li key={g} className="flex gap-2 py-2">
              <span className="mt-[3px] size-3 shrink-0 rounded-[2px] bg-rain/60" />
              <span>
                <b>{mm} mm fell before the file starts</b> (daily total at the first reading). Counted as rain already in each bucket.
              </span>
            </li>
          ))}
        {s.clean.flags
          .filter((f) => f.kind !== "unreliable")
          .map((f, k) => (
            <li key={k} className="flex gap-2 py-2">
              <span className="hatch mt-[3px] size-3 shrink-0 rounded-[2px] ring-1 ring-nocall" />
              <span>
                <b>
                  {FLAG_TEXT[f.kind]}: {gaugeName(f.gaugeId)}
                </b>
                , {dayLabel(T(f.i0))} {hhmm(T(f.i0))}–{hhmm(T(f.i1) + STEP_MS)}
                {f.value != null ? ` (${f.value} mm)` : ""}.{" "}
                <span className="text-ink-muted">{f.filledFrom ? `Filled from ${gaugeName(f.filledFrom)}.` : f.kind === "gap" ? "No call while silent." : "Removed."}</span>
              </span>
            </li>
          ))}
        {notes
          .filter((n) => !/rg1: rain taken|ignored\.|before the file starts/.test(n))
          .map((n) => (
            <li key={n} className="py-2 text-ink-muted">
              {n}
            </li>
          ))}
      </ul>
    </div>
  );
}
