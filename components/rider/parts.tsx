"use client";

import { IconBrandWhatsapp, IconChevronRight, IconCopy, IconExternalLink, IconList, IconMap, IconRoute } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useReduced } from "@/lib/useReduced";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GGauge, GPost, GPostHigh, GPostLow } from "@/components/brand/glyphs";
import { MarkPost } from "@/components/brand/marks";
import { DepthPost } from "@/components/viz/DepthPost";
import { CALL_TEXT, cx, StatusChip } from "@/components/ui/primitives";
import { t, type Lang } from "@/lib/i18n";
import { dayLabel, hhmm } from "@/lib/model/time";
import { STEP_MS, type Status } from "@/lib/model/types";
import { useStore } from "@/lib/state/store";
import { durText, fmtMm, shareMessage, type CallView } from "@/lib/view";

export function AppHeader({ gaugeName, rainHour }: { gaugeName: string; rainHour: number }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-[2px]">
      <div className="flex h-14 items-center gap-2 px-4">
        <MarkPost size={22} title="" aria-hidden />
        <span className="font-display text-[20px] font-bold leading-none">Crossing Watch</span>
        <span className="flex-1" />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-surface-2 px-2 font-mono text-[12.5px] font-semibold tnum" title={`Rain in the last hour at ${gaugeName}`}>
          <GGauge size={14} className="text-rain" />
          {fmtMm(rainHour)} mm/h
        </span>
      </div>
    </header>
  );
}

export function CrossingRow({ v, onOpen }: { v: CallView; lang?: Lang; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex min-h-16 w-full items-center gap-3 border-b border-line bg-surface-1 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2 focus-visible:outline-offset-[-2px]"
    >
      <span className="w-[104px] shrink-0">
        <StatusChip call={v.call} label={v.verb} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-bold leading-snug">{v.crossing.short ?? v.crossing.name}</span>
        <span className="block truncate text-[14px] leading-snug text-ink-muted">{v.sub}</span>
      </span>
      <IconChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

export function ReportButtons({ v, lang }: { v: CallView; lang: Lang }) {
  const s = useStore();
  const reduce = useReduced();
  const [sent, setSent] = useState<Status | null>(null);
  const pending = useRef<{ id: string; before: { lo: number; hi: number } } | null>(null);
  const already = s.deviceReportedAt(v.crossing.id, s.clock.i);
  const model = v.model;

  useEffect(() => {
    if (!pending.current) return;
    const { id, before } = pending.current;
    pending.current = null;
    const a = Math.round(model.band.lo);
    const b = Math.round(model.band.hi);
    const a0 = Math.round(before.lo);
    const b0 = Math.round(before.hi);
    const same = a === a0 && b === b0;
    toast.success(t(lang, same ? "toast.sharpened.same" : "toast.sharpened", { name: v.crossing.short ?? v.crossing.name, a, b, a0, b0 }), {
      duration: 6000,
      action: {
        label: t(lang, "toast.undo"),
        onClick: () => {
          s.undo(id);
          setSent(null);
          toast(t(lang, "toast.removed"));
        },
      },
    });
  }, [model, lang, s, v.crossing.name, v.crossing.short]);

  useEffect(() => {
    if (!sent) return;
    const id = window.setTimeout(() => setSent(null), 2600);
    return () => window.clearTimeout(id);
  }, [sent]);

  const tap = (status: Status) => {
    if (already) return;
    pending.current = { id: "", before: { lo: model.band.lo, hi: model.band.hi } };
    const r = s.report(v.crossing.id, status);
    pending.current.id = r.id;
    setSent(status);
  };

  const btn = (status: Status) => {
    const on = sent === status;
    const Icon = status === "flooded" ? GPostHigh : GPostLow;
    const col = status === "flooded" ? "var(--reroute-text)" : "var(--cross-text)";
    const fill = status === "flooded" ? "var(--reroute)" : "var(--cross)";
    return (
      <button
        onClick={() => tap(status)}
        disabled={already && !on}
        title={already && !on ? "You reported at this time. Move the replay on to report again." : undefined}
        className={cx(
          "flex h-14 flex-1 items-center justify-center gap-2 rounded-md border-2 text-[17px] font-bold transition-[background-color,color,opacity,transform] duration-150 active:scale-[.97]",
          "disabled:opacity-40 disabled:active:scale-100",
          sent && !on && "opacity-40",
        )}
        style={{ borderColor: col, background: on ? fill : "var(--surface-1)", color: on ? "var(--on-signal)" : "var(--ink)" }}
      >
        {on ? (
          <motion.svg viewBox="0 0 24 24" width={22} height={22} initial={reduce ? false : "h"} animate="v" aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              variants={{ h: { pathLength: 0 }, v: { pathLength: 1, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } } }}
            />
          </motion.svg>
        ) : (
          <Icon size={22} style={{ color: col }} />
        )}
        {t(lang, `report.${status}`)}
      </button>
    );
  };

  return (
    <section aria-label="Report" className="px-3">
      <p className="mb-2 px-1 text-[14px] text-ink-muted">{t(lang, "report.prompt", { name: v.crossing.short ?? v.crossing.name })}</p>
      <div className="flex gap-2">
        {btn("flooded")}
        {btn("clear")}
      </div>
    </section>
  );
}

export function DetourCard({ v, lang, onShow }: { v: CallView; lang: Lang; onShow?: () => void }) {
  const d = v.detour ?? v.crossing.detours[0];
  if (!d) return <p className="mx-3 rounded-lg border border-line bg-surface-1 p-4 text-[14px] text-ink-muted">{t(lang, "detour.none")}</p>;
  const risky = v.detourCall && v.detourCall !== "cross";
  return (
    <button onClick={onShow} className="mx-3 flex items-center gap-3 rounded-lg border border-line bg-surface-1 p-4 text-left transition-colors hover:border-line-strong">
      <IconRoute size={22} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold">{d.via}</span>
        <span className="block text-[14px] text-ink-muted">
          +{d.extraMin} min{d.km ? ` · ${d.km} km` : ""}
          {risky ? ` · ${t(lang, "detour.risky")}` : ""}
        </span>
      </span>
      {v.detourCall && <StatusChip call={v.detourCall} label={t(lang, `verb.${v.detourCall}`)} />}
    </button>
  );
}

export function ShareBlock({ v, lang }: { v: CallView; lang: Lang }) {
  const s = useStore();
  const gauge = s.series.gauges.find((g) => g.id === v.crossing.gaugeId);
  const gaugeName = gauge ? gauge.name.replace(/ ·.*/, "") : "the gauge";
  const [origin, setOrigin] = useState("https://crossing-watch.app");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);
  const msg = shareMessage(v, s.series, s.clock.i, gaugeName, `${origin}/app?c=${v.crossing.id}`, lang);
  return (
    <section className="mx-3 rounded-lg border border-line bg-surface-1 p-3">
      <pre className="whitespace-pre-wrap rounded-md bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed text-ink">{msg}</pre>
      <div className="mt-3 flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-4 text-[15px] font-bold text-accent-ink transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[.97]"
        >
          <IconBrandWhatsapp size={20} aria-hidden />
          {t(lang, "share.send")}
        </a>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(msg);
              toast(t(lang, "share.copied"));
            } catch {
              toast("Couldn't reach the clipboard. Select the text instead.");
            }
          }}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-line bg-surface-1 px-4 text-[15px] font-bold transition-colors hover:bg-surface-2 active:scale-[.97]"
        >
          <IconCopy size={18} aria-hidden />
          {t(lang, "share.copy")}
        </button>
      </div>
    </section>
  );
}

export function WhyList({ v, lang }: { v: CallView; lang: Lang }) {
  const s = useStore();
  const gauge = s.series.gauges.find((g) => g.id === v.crossing.gaugeId);
  const k = v.model.nStorms;
  const n = v.nReports;
  const rows: { icon: React.ReactNode; text: string }[] = [];
  if (v.call === "nocall") rows.push({ icon: <GGauge size={16} />, text: t(lang, "why.gauge", { g: gauge?.name ?? "" }) });
  rows.push({ icon: <GPost size={16} />, text: t(lang, "why.bucket", { s: fmtMm(v.level), r3: fmtMm(v.rain3h) }) });
  rows.push({
    icon: <span className="block size-3 rounded-[2px] bg-reroute/60" />,
    text: v.estimate
      ? `${t(lang, "why.estimate")} (${v.bandText}).`
      : t(lang, "why.trigger", { a: Math.round(v.band.lo), b: Math.round(v.band.hi), n, ns: n === 1 ? "" : "s", k, ks: k === 1 ? "" : "s" }),
  });
  if (v.clearsAt && v.call !== "cross") rows.push({ icon: <IconRoute size={16} />, text: t(lang, "why.outlook.flood", { time: v.clearsAt }) });
  else if (v.floodsBy) rows.push({ icon: <IconRoute size={16} />, text: t(lang, "why.outlook.rise", { time: v.floodsBy }) });
  else if (v.call === "cross") rows.push({ icon: <IconRoute size={16} />, text: t(lang, "why.outlook.calm") });

  const reports = s.reports.filter((r) => r.crossingId === v.crossing.id);
  return (
    <section className="mx-3 rounded-lg border border-line bg-surface-1 p-4">
      <h3 className="text-[15px] font-bold text-ink">Why this call</h3>
      <ul className="mt-2 space-y-2">
        {rows.map((r, k) => (
          <li key={k} className="flex gap-2.5 text-[15px] leading-snug">
            <span className="mt-[3px] flex w-4 shrink-0 justify-center text-ink-muted">{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      {reports.length > 0 && (
        <details className="mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer text-[14px] font-bold">
            Reports ({reports.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {reports.map((r) => {
              const obs = v.model.obs.find((o) => o.reportId === r.id);
              const at = obs ? s.series.start + obs.i * STEP_MS : r.t;
              return (
                <li key={r.id} className="text-[13.5px] leading-snug">
                  <span className="font-bold" style={{ color: CALL_TEXT[r.status === "flooded" ? "reroute" : "cross"] }}>
                    {r.status === "flooded" ? t(lang, "report.flooded") : t(lang, "report.clear")}
                  </span>{" "}
                  <span className="font-mono text-[12.5px] tnum text-ink-muted">
                    {dayLabel(at, lang)} {hhmm(at)}
                    {obs ? ` · ${fmtMm(obs.level)} mm` : " · outside this data"}
                  </span>
                  <br />
                  <span className="text-ink-muted">
                    {r.source === "news" ? "News" : r.source === "seed" ? "Demo report" : r.device ? "Rider" : "Rider"}
                    {r.note ? `: ${r.note}` : ""}
                  </span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-accent underline underline-offset-2">
                      source <IconExternalLink size={12} aria-hidden />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

export function PostPanel({ v, lang, freshId }: { v: CallView; lang: Lang; freshId?: string }) {
  const ticks = v.model.obs.map((o) => ({ id: o.reportId, level: o.level, status: o.status, fresh: o.reportId === freshId }));
  return (
    <section className="mx-3 flex items-stretch gap-4 rounded-lg border border-line bg-surface-1 p-4">
      <PostScale />
      <div className="-ml-2 pt-1">
        <DepthPostLarge v={v} ticks={ticks} />
      </div>
      <dl className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1 text-[14px]">
        <div>
          <dt className="label text-ink-muted">{lang === "sw" ? "Ndoo ya mvua" : "In the bucket"}</dt>
          <dd className="font-mono text-[22px] font-semibold leading-tight tnum text-rain">{fmtMm(v.level)} mm</dd>
        </div>
        <div>
          <dt className="label text-ink-muted">{lang === "sw" ? "Hufurika kati ya" : "Floods between"}</dt>
          <dd className="font-mono text-[18px] font-semibold leading-tight tnum" style={{ color: "var(--reroute-text)" }}>
            {v.bandText}
          </dd>
          {v.estimate && <dd className="text-[12.5px] text-ink-muted">{lang === "sw" ? "kisio, hakuna ripoti" : "estimate, no reports yet"}</dd>}
        </div>
        <div className="text-[12.5px] leading-snug text-ink-muted">
          {lang === "sw" ? "Hupungua nusu kila" : "Drains by half every"} {durText(v.crossing.halfLifeH * 60, lang)}
        </div>
      </dl>
    </section>
  );
}

function PostScale() {
  return (
    <div aria-hidden className="flex h-[190px] flex-col justify-between pt-0 font-mono text-[10px] leading-none text-ink-muted tnum">
      {[80, 60, 40, 20, 0].map((mm) => (
        <span key={mm}>{mm}</span>
      ))}
    </div>
  );
}

function DepthPostLarge({ v, ticks }: { v: CallView; ticks: { id: string; level: number; status: Status; fresh?: boolean }[] }) {
  return <DepthPost variant="large" level={v.level} band={v.band} ticks={ticks} uncertain={v.estimate} stale={v.call === "nocall"} />;
}

export function TabBar({ tab, onTab, lang }: { tab: "home" | "map"; onTab: (t: "home" | "map") => void; lang: Lang }) {
  const items = [
    { id: "home" as const, label: t(lang, "tab.crossings"), Icon: IconList },
    { id: "map" as const, label: t(lang, "tab.map"), Icon: IconMap },
  ];
  return (
    <nav className="grid shrink-0 grid-cols-2 border-t border-line bg-canvas pb-[max(env(safe-area-inset-bottom),6px)]" aria-label="Sections">
      {items.map(({ id, label, Icon }) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => onTab(id)} aria-current={on ? "page" : undefined} className={cx("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[12.5px] font-bold", on ? "text-ink" : "text-ink-muted")}>
            {on && <motion.span layoutId="tab-ind" className="absolute inset-x-8 top-0 h-0.5 bg-accent" transition={{ type: "spring", visualDuration: 0.25, bounce: 0.15 }} />}
            <Icon size={20} aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function StatusRow({ time, label }: { time: string; label: string }) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between bg-canvas px-5 pt-1 font-mono text-[12px] font-semibold tnum text-ink">
      <span>{time}</span>
      <span className="label text-[10.5px] text-ink-muted">{label}</span>
    </div>
  );
}

