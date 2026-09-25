"use client";

import { IconAlertTriangle, IconFileUpload, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { RiderApp, useCallViews } from "@/components/rider/RiderApp";
import { CrossingMap, type MapPost } from "@/components/viz/CrossingMap";
import { dayLabel, hhmm } from "@/lib/model/time";
import { useStore } from "@/lib/state/store";
import { CommandPalette } from "./CommandPalette";
import { PhoneFrame } from "./PhoneFrame";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";

type Mode = "wide" | "mid" | "narrow";

function useMode(): Mode | null {
  const [m, setM] = useState<Mode | null>(null);
  useEffect(() => {
    const f = () => setM(window.innerWidth >= 1200 ? "wide" : window.innerWidth >= 768 ? "mid" : "narrow");
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}

export function StageToaster({ position = "top-right" }: { position?: "top-right" | "bottom-right" | "bottom-center" | "top-center" }) {
  return (
    <Toaster
      position={position}
      offset={position === "top-right" ? { top: 118, right: 36 } : 20}
      toastOptions={{
        style: { background: "var(--ink)", color: "var(--canvas)", border: "none", borderRadius: 6, fontFamily: "var(--ff-body)", fontSize: 14 },
        actionButtonStyle: { background: "var(--canvas)", color: "var(--ink)", fontWeight: 700 },
      }}
    />
  );
}

/** The one line the county gives riders, set against the map that names crossings. */
function WarningLine() {
  const s = useStore();
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-4 py-2">
      <IconAlertTriangle size={18} className="shrink-0 text-wait-text" aria-hidden />
      <p className="min-w-0 text-[15px] leading-snug">
        <span className="text-ink-muted">County warning, 7 Mar:</span> <b className="font-bold">&ldquo;More than 80&nbsp;mm in some areas.&rdquo;</b>{" "}
        <span className="text-ink-muted">No road, no crossing, no hour.</span>
      </p>
      <span className="flex-1" />
      <span className="hidden shrink-0 text-[13px] text-ink-muted xl:inline">
        {s.source.kind === "demo" ? "Simulated storm" : "JKUAT gauge"} · {dayLabel(s.now)} {hhmm(s.now)}
      </span>
    </div>
  );
}

/** Map frame is 1000×520 map units; the basemap carries ~130 units of geometry past each edge (less to the east). */
const GW = 1000;
const GH = 520;
const EDGE = 130;

function MapArea({ posts, detours }: { posts: MapPost[]; detours: { id: string; path: [number, number][]; strong?: boolean }[] }) {
  const s = useStore();
  const body = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // fill the panel: widen the view into the basemap's margin instead of letterboxing
  const aspect = box.h > 0 ? box.w / box.h : GW / GH;
  const view =
    aspect < GW / GH
      ? (() => {
          const h = Math.min(GH + 2 * EDGE, GW / aspect);
          return { x: 0, y: (GH - h) / 2, w: GW, h };
        })()
      : (() => {
          const w = Math.min(GW + 2 * EDGE, GH * aspect);
          return { x: (GW - w) / 2, y: 0, w, h: GH };
        })();
  const w = Math.floor(Math.min(box.w, box.h * (view.w / view.h)));
  return (
    <div ref={body} className="flex min-h-0 flex-1 items-center justify-center bg-canvas">
      {w > 0 && (
        <div style={{ width: w }}>
          <CrossingMap
            view={view}
            posts={posts}
            selectedId={s.selectedId}
            detours={detours}
            gauges={s.series.gauges}
            legend
            onSelect={(id) => {
              s.select(id);
              s.setPhone({ name: "detail", id });
            }}
          />
        </div>
      )}
    </div>
  );
}

function DropOverlay() {
  const s = useStore();
  const [on, setOn] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setOn(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOn(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOn(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) s.importFile(f);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [s]);
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 bg-canvas/90 p-6 [animation:pop_150ms_var(--ease-out)]">
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-accent text-center">
        <IconFileUpload size={36} className="text-accent" aria-hidden />
        <p className="font-display text-[36px] font-bold leading-tight">Drop the station CSV to replay real readings</p>
        <p className="text-[16px] text-ink-muted">15-min or 5-min rain, any column names: time and rain columns are detected. JHUB and TAHMO exports work as they are.</p>
      </div>
    </div>
  );
}

function ReplayBar() {
  const s = useStore();
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3">
      <button onClick={s.toggle} aria-label={s.clock.playing ? "Pause replay" : "Play replay"} className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-accent-ink">
        {s.clock.playing ? <IconPlayerPauseFilled size={16} /> : <IconPlayerPlayFilled size={16} />}
      </button>
      <span className="font-mono text-[12.5px] font-semibold tnum">
        {dayLabel(s.now, s.lang)} {hhmm(s.now)}
      </span>
      <input
        type="range"
        min={s.clock.i0}
        max={s.clock.i1}
        value={s.clock.i}
        onChange={(e) => s.seek(+e.target.value)}
        aria-label="Replay time"
        className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
      />
    </div>
  );
}

export function Stage({ pinnedId }: { pinnedId?: string }) {
  const s = useStore();
  const mode = useMode();
  const views = useCallViews();
  const [palette, setPalette] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const live = useRef(s);
  useEffect(() => {
    live.current = s;
  });
  // hook for scripted recordings: stop the replay at an exact time
  useEffect(() => {
    (window as unknown as { __cwReplay?: object }).__cwReplay = { stopAt: (t: string) => live.current.stopAt(t) };
  }, []);

  const pin = pinnedId ?? s.crossings[0]?.id;
  const list = useMemo(() => s.crossings.map((c) => views[c.id]).filter(Boolean), [s.crossings, views]);
  const posts: MapPost[] = list.map((v) => ({ id: v.crossing.id, label: v.verb, call: v.call, model: v.model, level: v.level }));
  // only the detours that matter right now: the rider's route, and the crossing being looked at
  const detours = list
    .filter((v) => v.call === "reroute" && v.detour?.path && (v.crossing.id === pin || v.crossing.id === s.selectedId))
    .map((v) => ({ id: v.crossing.id, path: v.detour!.path!, strong: true }));

  // keyboard: instant, no animation on shortcut-triggered changes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = live.current;
      const el = e.target as HTMLElement;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        st.resetDemo();
        toast("Demo reset: reports cleared, replay rewound");
        return;
      }
      if (mod || e.altKey || el.closest("input,textarea,select,[contenteditable=true],[cmdk-root],[role=slider]")) return;
      switch (e.key) {
        case " ":
          if (el.closest("button,a")) return;
          e.preventDefault();
          st.toggle();
          break;
        case "ArrowRight":
          st.step(e.shiftKey ? 4 : 1);
          break;
        case "ArrowLeft":
          st.step(e.shiftKey ? -4 : -1);
          break;
        case "1":
        case "2":
        case "4":
          st.setSpeed(+e.key as 1 | 2 | 4);
          break;
        case "j":
        case "J":
          st.jumpToStorm();
          break;
        case "l":
        case "L":
          st.setLang(st.lang === "en" ? "sw" : "en");
          break;
        case "r":
        case "R":
          st.seek(st.clock.i0);
          break;
        case "0":
          st.resetDemo();
          toast("Demo reset: reports cleared, replay rewound");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // import outcome toasts
  const prevImport = useRef(s.importState.status);
  useEffect(() => {
    const was = prevImport.current;
    prevImport.current = s.importState.status;
    if (was === "importing" && s.importState.status === "idle" && s.source.kind === "imported") {
      const g = s.series.gauges.filter((x) => !x.unreliable).length;
      const f = s.clean.flags.length;
      toast.success(`Loaded ${s.source.fileName}: ${s.series.n.toLocaleString()} steps, ${g} gauge${g === 1 ? "" : "s"}${f ? `, ${f} flag${f === 1 ? "" : "s"}` : ""}. Replay moved to the biggest storm.`);
    }
    if (was === "importing" && s.importState.status === "error") toast.error(s.importState.message);
  }, [s.importState, s.source, s.series, s.clean.flags.length]);

  if (mode === null) return <div className="h-dvh bg-canvas" />;

  if (mode === "narrow") {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <ReplayBar />
        <div className="min-h-0 flex-1">
          <RiderApp pinnedId={pinnedId} />
        </div>
        <StageToaster position="top-center" />
      </div>
    );
  }

  const wide = mode === "wide";
  return (
    <div className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-canvas">
      <TopBar onPalette={() => setPalette(true)} compact={!wide} />
      <main className={`grid min-h-0 flex-1 ${wide ? "grid-cols-[minmax(0,1fr)_380px] gap-6 px-6 pb-6 pt-5" : "grid-cols-[minmax(0,1fr)_300px] gap-4 p-4"}`}>
        <section aria-label="Storm replay" className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-canvas">
          <WarningLine />
          <MapArea posts={posts} detours={detours} />
          <Timeline height={wide ? 116 : 104} />
        </section>
        <PhoneFrame caption={<>Rider&rsquo;s phone, synced to the replay</>}>
          <RiderApp framed pinnedId={pinnedId} />
        </PhoneFrame>
      </main>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) s.importFile(f);
          e.target.value = "";
        }}
      />
      <DropOverlay />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onLoadCsv={() => fileRef.current?.click()} />
      <StageToaster />
    </div>
  );
}
