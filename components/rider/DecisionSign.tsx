"use client";

import { IconArrowRight, IconRefresh } from "@tabler/icons-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useReduced } from "@/lib/useReduced";
import { useState } from "react";
import { SEVERITY } from "@/lib/model/decide";
import type { Call, CrossingKind } from "@/lib/model/types";
import type { CallView } from "@/lib/view";
import { CALL_FILL, cx } from "@/components/ui/primitives";
import type { Lang } from "@/lib/i18n";

const KIND: Record<CrossingKind, { en: string; sw: string }> = {
  culvert: { en: "Culvert", sw: "Kalvati" },
  drift: { en: "Drift", sw: "Drifti" },
  dip: { en: "Road dip", sw: "Bonde" },
  bridge: { en: "Bridge", sw: "Daraja" },
  "high-bridge": { en: "Bridge", sw: "Daraja" },
};

const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

function SignFace({ v, compact, lang }: { v: CallView; compact?: boolean; lang: Lang }) {
  const call = v.call;
  const onWait = call === "wait";
  const chars = Math.max(4, v.verb.length);
  return (
    <div
      className="relative overflow-hidden rounded-lg px-4 pb-3.5 pt-4"
      style={{ background: CALL_FILL[call], color: onWait ? "var(--ink)" : "var(--on-signal)" }}
    >
      {call === "nocall" && <div aria-hidden className="hatch absolute inset-0 opacity-40" />}
      {/* the white inset border every road sign has */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[5px] rounded-[6px] border-[3px]"
        style={{ borderColor: onWait ? "color-mix(in oklch, var(--ink) 85%, transparent)" : "rgb(255 255 255 / .92)" }}
      />
      <div className="relative flex items-baseline justify-between gap-3 px-1">
        <span className={cx("min-w-0 truncate font-display font-bold leading-[1.05]", compact ? "text-[26px]" : "text-[30px]")}>{v.crossing.name}</span>
        <span className="label shrink-0 opacity-80">{KIND[v.crossing.kind][lang]}</span>
      </div>
      <div
        className="relative px-1 pt-1 font-display font-extrabold uppercase leading-[.88] tracking-[0.01em]"
        style={{ fontSize: `min(${compact ? 76 : 96}px, calc((100cqi - 40px) / ${(chars * 0.5).toFixed(2)}))` }}
      >
        {v.verb}
      </div>
      <p className={cx("relative mt-2 px-1 font-bold leading-tight", compact ? "text-[19px]" : "text-[22px]")}>{v.reason}</p>
      {v.action && (
        <div className="relative mt-3 flex items-center gap-2 rounded-[4px] bg-white px-3 py-2.5 text-[19px] font-bold leading-tight" style={{ color: "var(--reroute-text)" }}>
          <IconArrowRight size={22} stroke={2.5} aria-hidden className="shrink-0" />
          <span className="min-w-0">{v.action}</span>
        </div>
      )}
      <p className="relative mt-3 px-1 font-mono text-[12.5px] leading-snug tnum">{v.footer}</p>
    </div>
  );
}

/**
 * The call for a crossing, drawn as a road sign. Worse calls rise from the
 * bottom like water (T-02); better calls drain away (T-03).
 */
export function DecisionSign({
  view,
  lang,
  compact,
  state,
  onRetry,
}: {
  view: CallView | null;
  lang: Lang;
  compact?: boolean;
  state?: "loading" | "error";
  onRetry?: () => void;
}) {
  const reduce = useReduced();
  const [seen, setSeen] = useState<{ call: Call; dir: 1 | -1 } | null>(view ? { call: view.call, dir: 1 } : null);
  if (view && seen && seen.call !== view.call) {
    setSeen({ call: view.call, dir: SEVERITY[view.call] >= SEVERITY[seen.call] ? 1 : -1 });
  } else if (view && !seen) {
    setSeen({ call: view.call, dir: 1 });
  }
  const dir = seen?.dir ?? 1;

  if (state === "loading" || !view) {
    return (
      <div className="sk rounded-lg p-4" aria-busy style={{ height: compact ? 236 : 300 }}>
        <div className="h-7 w-2/3 rounded-sm bg-surface-1/60" />
        <div className="mt-4 h-20 w-4/5 rounded-sm bg-surface-1/60" />
        <div className="mt-4 h-6 w-1/2 rounded-sm bg-surface-1/60" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="rounded-lg border-2 border-line bg-surface-1 p-4">
        <p className="font-display text-[26px] font-bold leading-tight">{view.crossing.name}</p>
        <p className="mt-2 text-[16px] text-ink">Couldn&rsquo;t load the latest call. Showing the last one from {view.footer.split(" · ").at(-1)}.</p>
        <button onClick={onRetry} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[15px] font-bold text-canvas">
          <IconRefresh size={18} aria-hidden /> Retry
        </button>
      </div>
    );
  }

  const variants: Variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.15 } } }
    : {
        enter: (d: number) => (d > 0 ? { clipPath: "inset(100% 0% 0% 0%)", zIndex: 2 } : { clipPath: "inset(0% 0% 0% 0%)", zIndex: 1 }),
        center: (d: number) => ({ clipPath: "inset(0% 0% 0% 0%)", zIndex: d > 0 ? 2 : 1, transition: { duration: 0.48, ease: EASE_IN_OUT } }),
        exit: (d: number) =>
          d > 0
            ? { clipPath: "inset(0% 0% 0% 0%)", zIndex: 1, transition: { duration: 0.48 } }
            : { clipPath: "inset(100% 0% 0% 0%)", zIndex: 2, transition: { duration: 0.42, ease: EASE_IN_OUT } },
      };

  return (
    <div role="status" aria-live="polite" aria-label={view.aria} className="grid [&>*]:[grid-area:1/1]" style={{ containerType: "inline-size" }}>
      <AnimatePresence initial={false} custom={dir}>
        <motion.div key={view.call} custom={dir} variants={variants} initial="enter" animate="center" exit="exit">
          <SignFace v={view} compact={compact} lang={lang} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
