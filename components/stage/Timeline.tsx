"use client";

import { IconPlayerPauseFilled, IconPlayerPlayFilled, IconRotateClockwise, IconTargetArrow } from "@tabler/icons-react";
import NumberFlow from "@number-flow/react";
import { Button, Segmented } from "@/components/ui/primitives";
import { Hyetograph } from "@/components/viz/Hyetograph";
import { dayLabel, eat } from "@/lib/model/time";
import { useStore, type Speed } from "@/lib/state/store";

/** The replay strip: controls on the left, the rain that drives every call on the right. */
export function Timeline({ height = 112 }: { height?: number }) {
  const s = useStore();
  const { clock } = s;
  const e = eat(s.now);
  const ended = !clock.playing && clock.i >= clock.i1;
  const inStorm = clock.i0 === s.stormWindow.i0 && clock.i1 === s.stormWindow.i1;
  const sel = s.crossings.find((c) => c.id === s.selectedId) ?? s.crossings[0];
  const gid = sel?.gaugeId ?? s.series.gauges[0]?.id;
  const rain = s.clean.rain[gid] ?? new Float64Array(s.series.n);
  return (
    <div className="flex shrink-0 items-stretch border-t border-line bg-surface-1" style={{ height }}>
      <div className="flex w-[236px] shrink-0 flex-col justify-center gap-2.5 border-r border-line px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={s.toggle}
            aria-pressed={clock.playing}
            aria-label={clock.playing ? "Pause replay (Space)" : ended ? "Replay again (Space)" : "Play replay (Space)"}
            title={clock.playing ? "Pause (Space)" : "Play (Space)"}
            className="inline-flex size-11 items-center justify-center rounded-md bg-accent text-accent-ink transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[.94]"
          >
            {clock.playing ? <IconPlayerPauseFilled size={18} /> : ended ? <IconRotateClockwise size={18} /> : <IconPlayerPlayFilled size={18} />}
          </button>
          <Segmented<Speed>
            label="Replay speed"
            value={clock.speed}
            onChange={s.setSpeed}
            options={[
              { value: 1, label: "1×", title: "Speed 1 (key 1)" },
              { value: 2, label: "2×", title: "Speed 2 (key 2)" },
              { value: 4, label: "4×", title: "Speed 4 (key 4)" },
            ]}
          />
        </div>
        <div className="flex items-baseline gap-2 font-mono tnum">
          <span className="text-[24px] font-semibold leading-none text-ink">
            <NumberFlow value={e.h} format={{ minimumIntegerDigits: 2 }} />:
            <NumberFlow value={e.mi} format={{ minimumIntegerDigits: 2 }} />
          </span>
          <span className="text-[13px] text-ink-muted">{dayLabel(s.now, s.lang)}</span>
        </div>
      </div>
      <div className="relative min-w-0 flex-1 px-2 pt-2">
        <Hyetograph rain={rain} start={s.series.start} i0={clock.i0} i1={clock.i1} i={clock.i} onSeek={s.seek} height={height - 10} minimal reports={s.reports.filter((r) => r.crossingId === sel?.id)} />
        {!inStorm && (
          <Button size="sm" variant="secondary" onClick={() => s.jumpToStorm()} className="absolute right-3 top-2">
            <IconTargetArrow size={15} aria-hidden /> Jump to the storm
          </Button>
        )}
      </div>
    </div>
  );
}
