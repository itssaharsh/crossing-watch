"use client";

import { IconChevronLeft, IconExternalLink } from "@tabler/icons-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useReduced } from "@/lib/useReduced";
import { useMemo, useState } from "react";
import { CrossingMap, type MapPost } from "@/components/viz/CrossingMap";
import { SEVERITY } from "@/lib/model/decide";
import { t } from "@/lib/i18n";
import { dayLabel, hhmm } from "@/lib/model/time";
import { useStore, type PhoneScreen } from "@/lib/state/store";
import { callView, type CallView } from "@/lib/view";
import { DecisionSign } from "./DecisionSign";
import { AppHeader, CrossingRow, DetourCard, PostPanel, ReportButtons, ShareBlock, StatusRow, TabBar, WhyList } from "./parts";

const ORDER: Record<PhoneScreen["name"], number> = { home: 0, map: 1, detail: 2 };

export function useCallViews() {
  const s = useStore();
  return useMemo(() => {
    const out: Record<string, CallView> = {};
    for (const c of s.crossings) {
      const v = callView(s.series, s.models, c.id, s.clock.i, s.lang);
      if (v) out[c.id] = v;
    }
    return out;
  }, [s.series, s.models, s.crossings, s.clock.i, s.lang]);
}

export function RiderApp({ framed, pinnedId, state }: { framed?: boolean; pinnedId?: string; state?: "loading" | "error" }) {
  const s = useStore();
  const reduce = useReduced();
  const lang = s.lang;
  const views = useCallViews();
  const pinned = pinnedId ?? s.crossings[0]?.id;
  const pv = views[pinned];
  const screen = s.phone;
  const [dir, setDir] = useState(1);
  const go = (next: PhoneScreen) => {
    setDir(ORDER[next.name] >= ORDER[screen.name] ? 1 : -1);
    s.setPhone(next);
    if (next.name === "detail") s.select(next.id);
  };
  const gauge = s.series.gauges.find((g) => g.id === pv?.crossing.gaugeId);
  const gaugeName = gauge?.name.replace(/ \(.*\)$/, "") ?? "Gauge";

  const slide: Variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (d: number) => ({ x: d * 60, opacity: 0 }),
        center: { x: 0, opacity: 1, transition: { x: { duration: 0.4, ease: [0.77, 0, 0.175, 1] }, opacity: { duration: 0.21, delay: 0.15 } } },
        exit: (d: number) => ({ x: d * -60, opacity: 0, transition: { duration: 0.15 } }),
      };

  const others = Object.values(views)
    .filter((v) => v.crossing.id !== pinned)
    .sort((a, b) => SEVERITY[b.call] - SEVERITY[a.call] || b.pct - a.pct);

  const key = screen.name === "detail" ? `detail-${screen.id}` : screen.name;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas text-ink" style={{ containerType: "inline-size" }}>
      {framed && <StatusRow time={hhmm(s.now)} label={s.source.kind === "demo" ? "Simulated" : `Replay · ${dayLabel(s.now)}`} />}
      <AppHeader gaugeName={gaugeName} rainHour={pv?.rainHour ?? 0} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={key} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto overscroll-contain">
            {screen.name === "home" && (
              <div className="pb-8">
                <div className="px-3 pt-3">
                  <button onClick={() => pv && go({ name: "detail", id: pv.crossing.id })} className="block w-full rounded-lg text-left outline-offset-2" aria-label={`Open ${pv?.crossing.name}`}>
                    <DecisionSign view={pv ?? null} lang={lang} state={state} />
                  </button>
                </div>
                <h2 className="px-4 pb-2 pt-6 text-[15px] font-bold text-ink">{t(lang, "home.others")}</h2>
                <div className="border-t border-line">
                  {others.map((v) => (
                    <CrossingRow key={v.crossing.id} v={v} lang={lang} onOpen={() => go({ name: "detail", id: v.crossing.id })} />
                  ))}
                </div>
              </div>
            )}
            {screen.name === "detail" && views[screen.id] && <Detail v={views[screen.id]} onBack={() => go({ name: "home" })} onMap={() => go({ name: "map" })} />}
            {screen.name === "map" && <MapScreen views={views} onOpen={(id) => go({ name: "detail", id })} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar tab={screen.name === "map" ? "map" : "home"} onTab={(tab) => go({ name: tab })} lang={lang} />
    </div>
  );
}

function Detail({ v, onBack, onMap }: { v: CallView; onBack: () => void; onMap: () => void }) {
  const s = useStore();
  const lang = s.lang;
  const fresh = s.lastReport?.crossingId === v.crossing.id ? s.lastReport.id : undefined;
  return (
    <div className="space-y-4 pb-10">
      <div className="flex h-12 items-center px-1">
        <button onClick={onBack} className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-[15px] font-bold text-ink-muted hover:bg-surface-2 hover:text-ink">
          <IconChevronLeft size={20} aria-hidden />
          {t(lang, "back")}
        </button>
      </div>
      <div className="px-3">
        <DecisionSign view={v} lang={lang} compact />
      </div>
      <ReportButtons v={v} lang={lang} />
      <PostPanel v={v} lang={lang} freshId={fresh} />
      <WhyList v={v} lang={lang} />
      {v.crossing.detours.length > 0 && <DetourCard v={v} lang={lang} onShow={onMap} />}
      <ShareBlock v={v} lang={lang} />
      <p className="px-4 text-[12.5px] leading-snug text-ink-muted">
        {v.crossing.located}
        {v.crossing.note ? ` ${v.crossing.note}` : ""}
        {v.crossing.source?.url && (
          <a href={v.crossing.source.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-accent underline underline-offset-2">
            {v.crossing.source.label} <IconExternalLink size={12} aria-hidden />
          </a>
        )}
      </p>
    </div>
  );
}

function MapScreen({ views, onOpen }: { views: Record<string, CallView>; onOpen: (id: string) => void }) {
  const s = useStore();
  const posts: MapPost[] = Object.values(views).map((v) => ({ id: v.crossing.id, label: v.verb, call: v.call, model: v.model, level: v.level }));
  const detours = Object.values(views)
    .filter((v) => v.call === "reroute" && v.detour?.path)
    .map((v) => ({ id: v.crossing.id, path: v.detour!.path!, strong: true }));
  return (
    <div className="pb-6">
      <div className="border-b border-line">
        <CrossingMap posts={posts} selectedId={s.selectedId} onSelect={onOpen} detours={detours} gauges={s.series.gauges} view={{ x: 60, y: 20, w: 400, h: 470 }} compact />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-[12.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2 border border-ink bg-rain/80" /> rain in the bucket
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 bg-reroute/40" /> learned trigger
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-[5px] w-5 items-center rounded-full bg-ink px-[3px]">
            <span className="h-[1.5px] w-full rounded-full bg-surface-1" />
          </span>{" "}
          detour
        </span>
      </div>
      <div className="border-t border-line">
        {Object.values(views).map((v) => (
          <CrossingRow key={v.crossing.id} v={v} lang={s.lang} onOpen={() => onOpen(v.crossing.id)} />
        ))}
      </div>
    </div>
  );
}
