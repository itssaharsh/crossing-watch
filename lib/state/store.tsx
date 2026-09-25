"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import crossingsJson from "@/data/crossings.json";
import demoSeries from "@/data/demo/series.json";
import seedReportsJson from "@/data/reports.seed.json";
import stationSeries from "@/data/station/series.json";
import { assignGauges, ImportError, parseStationCsv } from "@/lib/model/csv";
import { buildModels, type CrossingModel } from "@/lib/model/decide";
import { qc, type CleanSeries } from "@/lib/model/faults";
import { findStorms, windowFor, type Storm } from "@/lib/model/storms";
import { parseEat } from "@/lib/model/time";
import { STEP_MS, type Crossing, type Report, type Series, type Status } from "@/lib/model/types";
import { t, type Lang } from "@/lib/i18n";
import { toast } from "sonner";

export const TICK_MS = 280;
export type Speed = 1 | 2 | 4;
export type SourceKind = "demo" | "station" | "imported";

export interface Clock {
  i: number;
  playing: boolean;
  speed: Speed;
  i0: number;
  i1: number;
  /** pause automatically when the replay reaches this step (scripted demos) */
  stopAt?: number | null;
}

export type PhoneScreen = { name: "home" } | { name: "detail"; id: string } | { name: "map" };

type ImportState = { status: "idle" } | { status: "dragging" } | { status: "importing"; file: string } | { status: "error"; file: string; message: string };

interface Source {
  kind: SourceKind;
  series: Series;
  fileName?: string;
  notes?: string[];
}

export const SEED_REPORTS: Report[] = (seedReportsJson as { reports: (Omit<Report, "t" | "until"> & { time: string; until?: string })[] }).reports.map(
  ({ time, until, ...r }) => ({ ...r, t: parseEat(time), until: until ? parseEat(until) : undefined }),
);
export const BASE_CROSSINGS = (crossingsJson as unknown as { crossings: Crossing[] }).crossings;
export const SIMULATED_SOURCE: Source = { kind: "demo", series: demoSeries as unknown as Series };
export const STATION_SOURCE: Source | null =
  stationSeries && typeof stationSeries === "object" && "rain" in (stationSeries as object)
    ? { kind: "station", series: stationSeries as unknown as Series }
    : null;
export const HAS_STATION = STATION_SOURCE != null;
function initialSource(pref?: "station" | "simulated"): Source {
  if (pref === "simulated" || !STATION_SOURCE) return SIMULATED_SOURCE;
  return STATION_SOURCE;
}

const LS_REPORTS = "cw.reports.v1";
const LS_DEVICE = "cw.device";
const LS_LANG = "cw.lang";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

function deviceId(): string {
  let id = safeGet(LS_DEVICE);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    safeSet(LS_DEVICE, id);
  }
  return id;
}

type ClockAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "tick" }
  | { type: "step"; by: number }
  | { type: "seek"; i: number }
  | { type: "speed"; speed: Speed }
  | { type: "window"; i0: number; i1: number; i?: number; play?: boolean }
  | { type: "stopAt"; i: number | null };

function clockReducer(c: Clock, a: ClockAction): Clock {
  switch (a.type) {
    case "play":
      return { ...c, playing: true, i: c.i >= c.i1 ? c.i0 : c.i };
    case "pause":
      return { ...c, playing: false };
    case "toggle":
      return c.playing ? { ...c, playing: false } : { ...c, playing: true, i: c.i >= c.i1 ? c.i0 : c.i };
    case "tick": {
      if (c.i >= c.i1) return { ...c, playing: false };
      const i = c.i + 1;
      if (c.stopAt != null && i >= c.stopAt) return { ...c, i, playing: false, stopAt: null };
      return { ...c, i, playing: i < c.i1 && c.playing };
    }
    case "stopAt":
      return { ...c, stopAt: a.i };
    case "step":
      return { ...c, i: Math.min(c.i1, Math.max(c.i0, c.i + a.by)) };
    case "seek":
      return { ...c, i: Math.min(c.i1, Math.max(c.i0, a.i)) };
    case "speed":
      return { ...c, speed: a.speed };
    case "window":
      return { ...c, i0: a.i0, i1: a.i1, i: a.i ?? a.i0, playing: a.play ?? c.playing };
  }
}

export interface Store {
  source: Source;
  series: Series;
  clean: CleanSeries;
  crossings: Crossing[];
  models: Record<string, CrossingModel>;
  storms: Storm[];
  stormWindow: { i0: number; i1: number };
  clock: Clock;
  now: number;
  reports: Report[];
  lang: Lang;
  selectedId: string;
  phone: PhoneScreen;
  importState: ImportState;
  lastReport: { id: string; crossingId: string; before: { lo: number; hi: number } } | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: (by: number) => void;
  seek: (i: number) => void;
  setSpeed: (s: Speed) => void;
  jumpToStorm: (storm?: Storm) => void;
  setWindow: (i0: number, i1: number) => void;
  select: (id: string) => void;
  setLang: (l: Lang) => void;
  setPhone: (s: PhoneScreen) => void;
  report: (crossingId: string, status: Status) => Report;
  undo: (id: string) => void;
  importFile: (f: File) => Promise<void>;
  setImportState: (s: ImportState) => void;
  setDataset: (d: "station" | "simulated") => void;
  /** pause when the replay clock shows this EAT time ("2026-03-20T18:15"); used by scripted recordings */
  stopAt: (eatTime: string) => void;
  resetDemo: () => void;
  deviceReportedAt: (crossingId: string, i: number) => boolean;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export interface StoreOptions {
  /** start time (EAT, "2026-03-18T16:45") or "first-red" (the pinned crossing's first reroute); defaults to the storm window start */
  startAt?: string;
  autoplay?: boolean;
  /** pinned crossing id */
  selected?: string;
  /** follow the stage's replay clock via /api/clock */
  follow?: boolean;
  /** publish this clock to /api/clock (the stage does) */
  publish?: boolean;
  /** force a dataset (?data=simulated) */
  dataset?: "station" | "simulated";
  /** replay again from the start a moment after it ends (landing hero) */
  loop?: boolean;
  /** no shared-report polling or toasts (a decorative instance, e.g. the landing hero) */
  quiet?: boolean;
}

export function StoreProvider({ children, options = {} }: { children: ReactNode; options?: StoreOptions }) {
  const [source, setSource] = useState<Source>(() => initialSource(options.dataset));
  const series = source.series;
  const clean = useMemo(() => qc(series), [series]);
  const crossings = useMemo(() => assignGauges(BASE_CROSSINGS, series), [series]);
  const storms = useMemo(() => {
    const g = series.gauges[0]?.id;
    return g ? findStorms(clean.rain[g]) : [];
  }, [series, clean]);
  const stormWindow = useMemo(() => windowFor(series, storms[0]), [series, storms]);

  const initialClock = useMemo<Clock>(() => {
    const w = windowFor(series, storms[0]);
    let i = w.i0;
    if (options.startAt) {
      const t = parseEat(options.startAt);
      // ?t= is the clock time shown, i.e. the end of a step
      if (Number.isFinite(t)) i = Math.min(w.i1, Math.max(w.i0, Math.round((t - series.start) / STEP_MS) - 1));
    }
    return { i, playing: false, speed: 1, i0: w.i0, i1: w.i1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [clock, dispatch] = useReducer(clockReducer, initialClock);

  const [localReports, setLocalReports] = useState<Report[]>([]);
  const [remoteReports, setRemoteReports] = useState<Report[]>([]);
  const [lang, setLangState] = useState<Lang>("en");
  const [selectedId, setSelectedId] = useState<string>(options.selected ?? BASE_CROSSINGS[0]?.id ?? "");
  const [phone, setPhone] = useState<PhoneScreen>({ name: "home" });
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [lastReport, setLastReport] = useState<Store["lastReport"]>(null);
  const device = useRef<string>("");

  // restore per-device state (a quiet instance keeps nothing between visits)
  useEffect(() => {
    device.current = deviceId();
    const l = safeGet(LS_LANG);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (l === "sw" || l === "en") setLangState(l);
    if (options.quiet) return;
    try {
      const raw = safeGet(LS_REPORTS);
      if (raw) setLocalReports(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [options.quiet]);

  useEffect(() => {
    if (!options.quiet) safeSet(LS_REPORTS, JSON.stringify(localReports));
  }, [localReports, options.quiet]);

  const reports = useMemo(() => {
    const byId = new Map<string, Report>();
    const dataset = source.kind === "demo" ? "simulated" : "station";
    const seeds = SEED_REPORTS.filter((r) => (r.dataset ?? "simulated") === dataset);
    for (const r of [...seeds, ...remoteReports, ...localReports]) byId.set(r.id, r);
    return [...byId.values()].sort((a, b) => a.t - b.t);
  }, [localReports, remoteReports, source.kind]);

  const models = useMemo(() => buildModels(series, clean, crossings, reports), [series, clean, crossings, reports]);

  // open at the pinned crossing's first red call (the rider app does this)
  const started = useRef(false);
  useEffect(() => {
    if (started.current || options.startAt !== "first-red") return;
    started.current = true;
    const m = models[options.selected ?? BASE_CROSSINGS[0]?.id];
    if (!m) return;
    for (let k = clock.i0; k <= clock.i1; k++) {
      if (m.calls[k]?.call === "reroute") {
        dispatch({ type: "seek", i: Math.min(clock.i1, k + 1) });
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  // clock ticking
  useEffect(() => {
    if (!clock.playing) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: "tick" });
    }, TICK_MS / clock.speed);
    return () => window.clearInterval(id);
  }, [clock.playing, clock.speed]);

  // autoplay once on load (demo)
  useEffect(() => {
    if (!options.autoplay) return;
    const id = window.setTimeout(() => dispatch({ type: "play" }), 1200);
    return () => window.clearTimeout(id);
  }, [options.autoplay]);

  // loop the replay (landing hero)
  const ended = !clock.playing && clock.i >= clock.i1;
  useEffect(() => {
    if (!options.loop || !ended) return;
    const id = window.setTimeout(() => {
      dispatch({ type: "seek", i: clock.i0 });
      dispatch({ type: "play" });
    }, 3200);
    return () => window.clearTimeout(id);
  }, [options.loop, ended, clock.i0]);

  // poll shared reports from other phones
  const remoteIds = useRef<Set<string>>(new Set());
  const [remoteToast, setRemoteToast] = useState<Report | null>(null);
  useEffect(() => {
    if (options.quiet) return;
    let alive = true;
    let first = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/reports", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { reports: Report[] };
        if (!alive) return;
        const fresh = j.reports.filter((r) => !remoteIds.current.has(r.id));
        for (const r of j.reports) remoteIds.current.add(r.id);
        setRemoteReports(j.reports);
        if (!first) {
          const other = fresh.find((r) => r.device !== device.current);
          if (other) setRemoteToast(other);
        }
        first = false;
      } catch {
        /* offline: local reports still work */
      }
    };
    pull();
    const id = window.setInterval(pull, 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [options.quiet]);

  // stage publishes its clock; phones can follow it
  const lastPublish = useRef(0);
  useEffect(() => {
    if (!options.publish || source.kind === "imported") return;
    const now = Date.now();
    if (now - lastPublish.current < 700 && clock.playing) return;
    lastPublish.current = now;
    fetch("/api/clock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ i: clock.i, playing: clock.playing, speed: clock.speed, i0: clock.i0, i1: clock.i1, kind: source.kind, n: series.n }),
    }).catch(() => {});
  }, [options.publish, clock, source.kind, series.n]);

  useEffect(() => {
    if (!options.follow) return;
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/clock", { cache: "no-store" });
        if (!res.ok) return;
        const c = (await res.json()) as { clock: (Clock & { kind: SourceKind; n: number; at: number }) | null };
        if (!alive || !c.clock || Date.now() - c.clock.at > 8000 || c.clock.n !== series.n) return;
        dispatch({ type: "window", i0: c.clock.i0, i1: c.clock.i1, i: c.clock.i, play: false });
      } catch {
        /* keep local clock */
      }
    };
    pull();
    const id = window.setInterval(pull, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [options.follow, series.n]);

  /** end of the current step: the reading that has just come in (reports are stamped 1 s earlier, inside the step) */
  const now = series.start + (clock.i + 1) * STEP_MS;

  const report = useCallback(
    (crossingId: string, status: Status): Report => {
      const m = models[crossingId];
      const r: Report = {
        id: `${device.current || "dev"}-${Date.now().toString(36)}`,
        crossingId,
        t: now - 1000,
        status,
        source: "rider",
        device: device.current,
      };
      if (m) setLastReport({ id: r.id, crossingId, before: { lo: m.band.lo, hi: m.band.hi } });
      setLocalReports((xs) => [...xs, r]);
      if (!options.quiet) {
        fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) }).catch(() => {});
      }
      return r;
    },
    [models, now, options.quiet],
  );

  const undo = useCallback((id: string) => {
    setLocalReports((xs) => xs.filter((r) => r.id !== id));
    setRemoteReports((xs) => xs.filter((r) => r.id !== id));
    fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const deviceReportedAt = useCallback(
    (crossingId: string, i: number) =>
      localReports.some((r) => r.crossingId === crossingId && Math.floor((r.t - series.start) / STEP_MS) === i),
    [localReports, series.start],
  );

  const jumpToStorm = useCallback(
    (storm?: Storm) => {
      const w = windowFor(series, storm ?? storms[0]);
      dispatch({ type: "window", i0: w.i0, i1: w.i1, i: w.i0 });
    },
    [series, storms],
  );

  const importFile = useCallback(async (f: File) => {
    setImportState({ status: "importing", file: f.name });
    try {
      const text = await f.text();
      const { series: s, notes } = parseStationCsv(text, f.name);
      const g = s.gauges[0]?.id;
      const st = g ? findStorms(qc(s).rain[g]) : [];
      const w = windowFor(s, st[0]);
      setSource({ kind: "imported", series: s, fileName: f.name, notes });
      dispatch({ type: "window", i0: w.i0, i1: w.i1, i: w.i0, play: false });
      setImportState({ status: "idle" });
    } catch (e) {
      setImportState({
        status: "error",
        file: f.name,
        message: e instanceof ImportError ? e.message : `Couldn't read ${f.name}: ${(e as Error).message}`,
      });
    }
  }, []);

  const setDataset = useCallback((d: "station" | "simulated") => {
    const next = initialSource(d);
    setSource(next);
    const s = next.series;
    const g = s.gauges[0]?.id;
    const st = g ? findStorms(qc(s).rain[g]) : [];
    const w = windowFor(s, st[0]);
    dispatch({ type: "window", i0: w.i0, i1: w.i1, i: w.i0, play: false });
  }, []);

  const resetDemo = useCallback(() => {
    setLocalReports([]);
    setRemoteReports([]);
    remoteIds.current = new Set();
    setLastReport(null);
    fetch("/api/reports", { method: "DELETE" }).catch(() => {});
    setPhone({ name: "home" });
    setSelectedId(options.selected ?? BASE_CROSSINGS[0]?.id ?? "");
    dispatch({ type: "window", i0: stormWindow.i0, i1: stormWindow.i1, i: stormWindow.i0, play: false });
    window.setTimeout(() => dispatch({ type: "play" }), 1200);
  }, [options.selected, stormWindow]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    safeSet(LS_LANG, l);
  }, []);

  const value: Store = {
    source,
    series,
    clean,
    crossings,
    models,
    storms,
    stormWindow,
    clock,
    now,
    reports,
    lang,
    selectedId,
    phone,
    importState,
    lastReport,
    play: () => dispatch({ type: "play" }),
    pause: () => dispatch({ type: "pause" }),
    toggle: () => dispatch({ type: "toggle" }),
    step: (by) => dispatch({ type: "step", by }),
    seek: (i) => dispatch({ type: "seek", i }),
    setSpeed: (speed) => dispatch({ type: "speed", speed }),
    jumpToStorm,
    setWindow: (i0, i1) => dispatch({ type: "window", i0, i1, i: Math.min(Math.max(clock.i, i0), i1) }),
    select: setSelectedId,
    setLang,
    setPhone,
    report,
    undo,
    importFile,
    setImportState,
    setDataset,
    stopAt: (eatTime: string) => {
      const t = parseEat(eatTime);
      if (Number.isFinite(t)) dispatch({ type: "stopAt", i: Math.round((t - series.start) / STEP_MS) - 1 });
    },
    resetDemo,
    deviceReportedAt,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <RemoteToastBridge report={remoteToast} />
    </Ctx.Provider>
  );
}

function RemoteToastBridge({ report }: { report: Report | null }) {
  const s = useContext(Ctx);
  useEffect(() => {
    if (!report || !s) return;
    const c = s.crossings.find((x) => x.id === report.crossingId);
    toast(t(s.lang, "toast.remote", { name: c?.name ?? report.crossingId, status: t(s.lang, `report.${report.status}`).toLowerCase() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);
  return null;
}
