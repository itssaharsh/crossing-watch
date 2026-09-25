"use client";

import { useMemo } from "react";
import { GDrift, GGauge, GPost, GPostHigh, GPostLow } from "@/components/brand/glyphs";
import { Lockup, MarkC, MarkDrift, MarkPost } from "@/components/brand/marks";
import { DecisionSign } from "@/components/rider/DecisionSign";
import { CrossingRow, PostPanel, ReportButtons } from "@/components/rider/parts";
import { StageToaster } from "@/components/stage/Stage";
import { Button, Kbd, Segmented, StatusChip } from "@/components/ui/primitives";
import { DepthPost } from "@/components/viz/DepthPost";
import { Hyetograph } from "@/components/viz/Hyetograph";
import { assignGauges } from "@/lib/model/csv";
import { buildModels, type CrossingModel } from "@/lib/model/decide";
import { qc } from "@/lib/model/faults";
import type { Call } from "@/lib/model/types";
import { BASE_CROSSINGS, SEED_REPORTS, SIMULATED_SOURCE, STATION_SOURCE, useStore } from "@/lib/state/store";
import { callView, type CallView } from "@/lib/view";

const CALLS: Call[] = ["cross", "wait", "reroute", "nocall"];

/** Real examples of each call, taken from the model rather than faked. */
function useExamples() {
  return useMemo(() => {
    const out: Partial<Record<Call, CallView>> = {};
    for (const src of [STATION_SOURCE, SIMULATED_SOURCE]) {
      if (!src) continue;
      const series = src.series;
      const crossings = assignGauges(BASE_CROSSINGS, series);
      const dataset = src.kind === "demo" ? "simulated" : "station";
      const models = buildModels(series, qc(series), crossings, SEED_REPORTS.filter((r) => (r.dataset ?? "simulated") === dataset));
      const order = ["kimbo-matangi", ...crossings.map((c) => c.id)];
      for (const call of CALLS) {
        if (out[call]) continue;
        for (const id of order) {
          const m: CrossingModel = models[id];
          const k = m.calls.findIndex((c, i) => c.call === call && (call !== "cross" || i > series.n / 2) && (call !== "wait" || c.reason === "clears_at"));
          if (k >= 0) {
            out[call] = callView(series, models, id, k, "en")!;
            break;
          }
        }
      }
    }
    return out;
  }, []);
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="font-display text-[26px] font-bold leading-none">{title}</h2>
      {note && <p className="mt-1 text-[14px] text-ink-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const SWATCHES = ["canvas", "surface-1", "surface-2", "line", "ink", "ink-muted", "accent", "rain", "cross", "wait", "reroute", "nocall", "murram"];

export function Kit({ state }: { state?: string }) {
  const s = useStore();
  const ex = useExamples();
  const sel = callView(s.series, s.models, "kimbo-matangi", s.clock.i, s.lang);

  if (state) {
    const call = (CALLS as string[]).includes(state) ? (state as Call) : "reroute";
    const v = ex[call] ?? sel;
    return (
      <div className="min-h-dvh bg-canvas p-3" style={{ maxWidth: 390 }}>
        <DecisionSign view={v ?? null} lang="en" state={state === "loading" || state === "error" ? state : undefined} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 pb-24 pt-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <Lockup mark={36} word={30} />
          <p className="mt-2 text-[15px] text-ink-muted">Component kit: every state, from real model output. Add <code className="font-mono text-[13px]">?state=cross|wait|reroute|nocall|loading|error</code> for one sign.</p>
        </div>
      </header>

      <Section title="Mark" note="A (depth post) is the chosen mark: it is also the map marker and the signature visual.">
        <div className="grid grid-cols-3 gap-6">
          {[
            { k: "A · depth post", M: MarkPost },
            { k: "B · drift", M: MarkDrift },
            { k: "C · monogram", M: MarkC },
          ].map(({ k, M }) => (
            <div key={k} className="rounded-lg border border-line bg-surface-1 p-5">
              <div className="flex items-end gap-6">
                <M size={16} />
                <M size={32} />
                <M size={128} />
              </div>
              <p className="mt-3 text-[14px] font-bold">{k}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-6 text-ink">
          {[GPost, GPostHigh, GPostLow, GGauge, GDrift].map((G, i) => (
            <span key={i} className="inline-flex size-10 items-center justify-center rounded-md border border-line bg-surface-1">
              <G size={20} />
            </span>
          ))}
          <span className="text-[13px] text-ink-muted">g-post · g-post-high · g-post-low · g-gauge · g-drift (24 grid, 2px round, Tabler-matched)</span>
        </div>
      </Section>

      <Section title="Colour" note="Colour means something: rain, a decision, or soil. Everything else is ink and grey.">
        <div className="grid grid-cols-7 gap-3">
          {SWATCHES.map((c) => (
            <div key={c} className="overflow-hidden rounded-md border border-line bg-surface-1">
              <div className="h-14" style={{ background: `var(--${c})` }} />
              <p className="px-2 py-1.5 font-mono text-[11.5px]">{c}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="Barlow Condensed (road-sign lineage) · Atkinson Hyperlegible Next and Mono (built so similar letters can't be confused).">
        <div className="space-y-3">
          <p className="font-display text-[96px] font-extrabold uppercase leading-[.88]">Reroute</p>
          <p className="font-display text-[30px] font-bold leading-tight">Kimbo–Matangi Road</p>
          <p className="text-[22px] font-bold">Likely flooded for ~2 h</p>
          <p className="text-[16px]">Body: 31 mm of rain in the bucket; 42 mm fell in the last 3 h.</p>
          <p className="font-mono text-[13px] tnum">72% · trigger 14–32 mm · 1 report · 18:15</p>
          <p className="label text-ink-muted">Label · on your route</p>
        </div>
      </Section>

      <Section title="Decision sign" note="C-21. Worse calls rise from the bottom like water; better calls drain away.">
        <div className="grid grid-cols-3 gap-6">
          {CALLS.map((c) => (
            <div key={c} style={{ width: 366 }}>
              <p className="label mb-2 text-ink-muted">{c}</p>
              <DecisionSign view={ex[c] ?? null} lang="en" />
            </div>
          ))}
          <div style={{ width: 366 }}>
            <p className="label mb-2 text-ink-muted">loading</p>
            <DecisionSign view={null} lang="en" state="loading" />
          </div>
          <div style={{ width: 366 }}>
            <p className="label mb-2 text-ink-muted">error</p>
            <DecisionSign view={ex.reroute ?? null} lang="en" state="error" />
          </div>
          <div style={{ width: 366 }}>
            <p className="label mb-2 text-ink-muted">reroute · Kiswahili</p>
            <DecisionSign view={sel ? callView(s.series, s.models, "kimbo-matangi", s.clock.i, "sw") : null} lang="sw" />
          </div>
        </div>
      </Section>

      <Section title="Depth post" note="C-13. Water = rain in the bucket. Red band = learned trigger (10–90%). Notches = reports (red flooded, green clear).">
        <div className="flex items-end gap-10">
          <DepthPost variant="marker" level={24} band={{ lo: 14, mid: 22, hi: 32 }} />
          <DepthPost variant="compact" level={24} band={{ lo: 14, mid: 22, hi: 32 }} ticks={[{ id: "a", level: 28, status: "flooded" }]} />
          <DepthPost variant="compact" level={40} band={{ lo: 28, mid: 50, hi: 88 }} uncertain />
          <DepthPost variant="compact" level={10} band={{ lo: 14, mid: 22, hi: 32 }} stale />
          <DepthPost
            variant="large"
            level={31}
            band={{ lo: 19, mid: 26, hi: 34 }}
            ticks={[
              { id: "a", level: 14, status: "clear" },
              { id: "b", level: 36, status: "flooded" },
              { id: "c", level: 25, status: "clear" },
              { id: "d", level: 30, status: "flooded", fresh: true },
            ]}
          />
          <p className="max-w-[260px] text-[13px] text-ink-muted">marker · compact with a report · uncertain (no reports, dashed) · stale (gauge fault, hatched) · large with four reports, newest ringed</p>
        </div>
      </Section>

      <Section title="Chips, buttons, controls">
        <div className="flex flex-wrap items-center gap-3">
          {CALLS.map((c) => (
            <StatusChip key={c} call={c} label={c === "nocall" ? "NO CALL" : c.toUpperCase()} />
          ))}
          <Button variant="primary">Send to stage group</Button>
          <Button>Copy</Button>
          <Button variant="ghost">How it works</Button>
          <Button variant="primary" disabled reason="Load rain data to replay">
            Play
          </Button>
          <Segmented label="Speed" value={1} onChange={() => {}} options={[{ value: 1, label: "1×" }, { value: 2, label: "2×" }, { value: 4, label: "4×" }]} />
          <Kbd>⌘K</Kbd>
        </div>
      </Section>

      <Section title="Report buttons" note="C-25, live against the store. One report per crossing per replay step; Undo in the toast.">
        <div style={{ width: 390 }} className="space-y-4 rounded-lg bg-canvas py-3">
          {sel && <ReportButtons v={sel} lang="en" />}
          {sel && <PostPanel v={sel} lang="en" />}
        </div>
      </Section>

      <Section title="Crossing rows">
        <div style={{ width: 390 }} className="border-t border-line">
          {CALLS.map((c) => (ex[c] ? <CrossingRow key={c} v={ex[c]!} lang="en" onOpen={() => {}} /> : null))}
        </div>
      </Section>

      <Section title="Rain chart" note="C-10. Bars hang from the top axis (hydrology convention); faint bars are still to come in the replay.">
        <div className="rounded-lg border border-line bg-surface-1 p-3">
          <Hyetograph
            rain={s.clean.rain[s.crossings[0]?.gaugeId] ?? []}
            start={s.series.start}
            i0={s.stormWindow.i0}
            i1={s.stormWindow.i1}
            i={s.clock.i}
            flags={s.clean.flags}
            reports={s.reports}
            onSeek={s.seek}
            height={190}
          />
        </div>
      </Section>
      <StageToaster />
    </div>
  );
}
