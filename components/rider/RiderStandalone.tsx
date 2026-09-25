"use client";

import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect } from "react";
import { StageToaster } from "@/components/stage/Stage";
import { dayLabel, hhmm } from "@/lib/model/time";
import { useStore } from "@/lib/state/store";
import { RiderApp } from "./RiderApp";

/** /app: the rider app on a real phone, with a thin replay bar on top. */
export function RiderStandalone({ openId, state }: { openId?: string; state?: string }) {
  const s = useStore();
  useEffect(() => {
    if (openId && s.crossings.some((c) => c.id === openId)) {
      s.select(openId);
      s.setPhone({ name: "detail", id: openId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col bg-canvas sm:border-x sm:border-line">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3">
        <button onClick={s.toggle} aria-label={s.clock.playing ? "Pause replay" : "Play replay"} className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-accent-ink">
          {s.clock.playing ? <IconPlayerPauseFilled size={16} /> : <IconPlayerPlayFilled size={16} />}
        </button>
        <span className="font-mono text-[12.5px] font-semibold tnum">
          {dayLabel(s.now, s.lang)} {hhmm(s.now)}
        </span>
        <input type="range" min={s.clock.i0} max={s.clock.i1} value={s.clock.i} onChange={(e) => s.seek(+e.target.value)} aria-label="Replay time" className="h-11 min-w-0 flex-1 accent-[var(--accent)]" />
      </div>
      <div className="min-h-0 flex-1">
        <RiderApp pinnedId="kimbo-matangi" state={state === "loading" || state === "error" ? state : undefined} />
      </div>
      <StageToaster position="top-center" />
    </div>
  );
}
