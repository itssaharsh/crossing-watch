"use client";

import { CALL_FILL, cx } from "@/components/ui/primitives";
import { DepthPost } from "@/components/viz/DepthPost";
import type { CallView } from "@/lib/view";
import { fmtMm } from "@/lib/view";

/** Every crossing's post side by side: same rain, different signatures. */
export function GaugeBoard({ views, selectedId, onSelect, wide }: { views: CallView[]; selectedId: string; onSelect: (id: string) => void; wide?: boolean }) {
  return (
    <div className={cx("flex h-full items-end justify-between gap-1", wide ? "px-6" : "px-2")} role="list" aria-label="Every crossing's bucket against its trigger">
      {views.map((v) => {
        const sel = v.crossing.id === selectedId;
        return (
          <button
            key={v.crossing.id}
            role="listitem"
            onClick={() => onSelect(v.crossing.id)}
            aria-label={`${v.crossing.name}: ${v.verb}, ${fmtMm(v.level)} mm in the bucket, floods between ${v.bandText}`}
            className={cx("group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0 pb-1 pt-1.5 transition-colors", sel ? "bg-surface-2" : "hover:bg-surface-2/60")}
          >
            <span aria-hidden className={cx("size-3 rounded-[2px] ring-[1.5px] ring-ink", v.call === "nocall" && "hatch")} style={{ background: v.call === "nocall" ? "var(--surface-2)" : CALL_FILL[v.call] }} />
            <DepthPost variant="compact" level={v.level} band={v.band} uncertain={v.estimate} stale={v.call === "nocall"} ticks={v.model.obs.map((o) => ({ id: o.reportId, level: o.level, status: o.status }))} />
            <span className="font-mono text-[11px] leading-none tnum text-rain">{fmtMm(v.level)}</span>
            <span className={cx("min-h-[26px] w-full text-center text-[10px] font-bold leading-[13px] tracking-[-0.02em]", sel ? "text-ink" : "text-ink-muted group-hover:text-ink")}>
              {(v.crossing.tag ?? v.crossing.short ?? v.crossing.name).replace("–", "–\u200b")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
