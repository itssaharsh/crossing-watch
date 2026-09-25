"use client";

import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Lockup } from "@/components/brand/marks";
import { GGauge } from "@/components/brand/glyphs";
import { Button, cx } from "@/components/ui/primitives";
import { DepthPost, type PostTick } from "@/components/viz/DepthPost";
import { Hyetograph, useWidth } from "@/components/viz/Hyetograph";
import { bucket } from "@/lib/model/bucket";
import { dayLabel, eat, hhmm } from "@/lib/model/time";
import { band, posterior, prior, THETA } from "@/lib/model/trigger";
import { STEP_MS, type Status } from "@/lib/model/types";
import { useStore } from "@/lib/state/store";
import { fmtMm } from "@/lib/view";

function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[34px] font-bold leading-[1.05]">
      <span className="mr-3 font-mono text-[15px] font-semibold text-ink-muted tnum">{n}</span>
      {children}
    </h2>
  );
}

/** Three buckets on the same storm: each crossing's own rain signature. */
function Signatures() {
  const s = useStore();
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 240;
  const w = s.stormWindow;
  const ids = ["jkuat-culvert", "kimbo-matangi", "ndarugu"];
  const lines = ids
    .map((id) => s.models[id])
    .filter(Boolean)
    .map((m) => ({ m, lvl: bucket(m.rain, m.crossing.halfLifeH, undefined, 0) }));
  const n = w.i1 - w.i0 + 1;
  const L = 34;
  const R = 150;
  const max = 70;
  const x = (k: number) => L + ((k - w.i0) / (n - 1)) * (W - L - R);
  const y = (mm: number) => 10 + (1 - Math.min(mm, max) / max) * (H - 36);
  const COLORS = ["var(--rain)", "var(--ink)", "var(--murram)"];
  // end labels, pushed apart so they never overlap
  const labelY = (() => {
    const ys = lines.map(({ lvl }, j) => ({ j, y: y(lvl[w.i1]) + 4 }));
    ys.sort((a, b) => a.y - b.y);
    for (let k = 1; k < ys.length; k++) ys[k].y = Math.max(ys[k].y, ys[k - 1].y + 15);
    const out: number[] = [];
    for (const e of ys) out[e.j] = e.y;
    return out;
  })();
  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      {W > 0 && (
        <svg width={W} height={H} className="block" role="img" aria-label="Bucket level over the 20 March storm for three crossings">
          <text x={L - 6} y={8} textAnchor="end" className="fill-ink-muted font-mono text-[10px]">
            mm
          </text>
          {[0, 20, 40, 60].map((mm) => (
            <g key={mm}>
              <line x1={L} x2={W - R} y1={y(mm)} y2={y(mm)} stroke="var(--line)" strokeOpacity={0.6} strokeDasharray={mm ? "2 3" : undefined} />
              <text x={L - 6} y={y(mm) + 4} textAnchor="end" className="fill-ink-muted font-mono text-[10.5px]">
                {mm}
              </text>
            </g>
          ))}
          {lines.map(({ m, lvl }, j) => {
            let d = "";
            for (let k = w.i0; k <= w.i1; k++) d += `${k === w.i0 ? "M" : "L"}${x(k).toFixed(1)} ${y(lvl[k]).toFixed(1)}`;
            // first step over the median trigger
            let hit = -1;
            for (let k = w.i0; k <= w.i1; k++)
              if (lvl[k] >= m.band.mid) {
                hit = k;
                break;
              }
            const lastK = w.i1;
            return (
              <g key={m.crossing.id}>
                <rect x={L} y={y(m.band.hi)} width={W - R - L} height={Math.max(1, y(m.band.lo) - y(m.band.hi))} fill={COLORS[j]} opacity={0.05} />
                <path d={d} fill="none" stroke={COLORS[j]} strokeWidth={2.25} />
                {hit >= 0 && <circle cx={x(hit)} cy={y(lvl[hit])} r={4.5} fill="var(--reroute)" stroke="var(--canvas)" strokeWidth={1.5} />}
                <text x={x(lastK) + 8} y={labelY[j]} className="text-[12.5px] font-bold" fill={COLORS[j]}>
                  {m.crossing.tag} · {m.crossing.halfLifeH < 1 ? `${m.crossing.halfLifeH * 60} min` : `${m.crossing.halfLifeH} h`}
                </text>
              </g>
            );
          })}
          {Array.from({ length: n }, (_, j) => w.i0 + j)
            .filter((k) => eat(s.series.start + k * STEP_MS).mi === 0 && eat(s.series.start + k * STEP_MS).h % 3 === 0)
            .map((k) => (
              <text key={k} x={x(k)} y={H - 6} textAnchor="middle" className="fill-ink-muted font-mono text-[10.5px]">
                {hhmm(s.series.start + k * STEP_MS)}
              </text>
            ))}
        </svg>
      )}
    </div>
  );
}

/** Interactive: each report narrows the trigger (the posterior over θ). */
function Learner() {
  const PRIOR_MEDIAN = 50;
  const [level, setLevel] = useState(52);
  const [obs, setObs] = useState<{ id: string; level: number; status: Status }[]>([]);
  const pri = useMemo(() => prior(PRIOR_MEDIAN), []);
  const post = useMemo(() => posterior(pri, obs.map((o) => ({ level: o.level, status: o.status, weight: 0.8 }))), [pri, obs]);
  const b = band(post);
  const b0 = band(pri);
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 120;
  const maxX = 110;
  const px = (mm: number) => (Math.min(mm, maxX) / maxX) * W;
  const peak = Math.max(...Array.from(post).slice(0, maxX));
  const area = (p: Float64Array, pk: number) => {
    let d = `M0 ${H - 18}`;
    for (let j = 0; j < THETA.length && THETA[j] <= maxX; j++) d += `L${px(THETA[j]).toFixed(1)} ${(H - 18 - (p[j] / pk) * (H - 30)).toFixed(1)}`;
    return d + `L${px(maxX)} ${H - 18}Z`;
  };
  const ticks: PostTick[] = obs.map((o, k) => ({ id: o.id, level: o.level, status: o.status, fresh: k === obs.length - 1 }));
  const width0 = b0.hi - b0.lo;
  const width1 = b.hi - b.lo;
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[auto_1fr]">
      <div className="flex items-start gap-3">
        <div className="flex h-[190px] flex-col justify-between font-mono text-[10px] leading-none text-ink-muted">
          {[80, 60, 40, 20, 0].map((mm) => (
            <span key={mm}>{mm}</span>
          ))}
        </div>
        <DepthPost variant="large" level={level} band={b} ticks={ticks} uncertain={!obs.length} />
      </div>
      <div className="min-w-0">
        <label className="block text-[14px] font-bold" htmlFor="lvl">
          Bucket level when the rider looked: <span className="font-mono text-rain tnum">{level} mm</span>
        </label>
        <input id="lvl" type="range" min={0} max={80} value={level} onChange={(e) => setLevel(+e.target.value)} className="mt-2 h-8 w-full max-w-[420px] accent-[var(--rain)]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setObs((o) => [...o, { id: `f${o.length}`, level, status: "flooded" }])} className="border-2 border-reroute-text">
            Seen flooded at {level} mm
          </Button>
          <Button onClick={() => setObs((o) => [...o, { id: `c${o.length}`, level, status: "clear" }])} className="border-2 border-cross-text">
            Seen clear at {level} mm
          </Button>
          <Button variant="ghost" onClick={() => setObs([])} disabled={!obs.length} reason="No reports yet">
            Start over
          </Button>
        </div>
        <div ref={ref} className="mt-5 w-full max-w-[560px]">
          {W > 0 && (
            <svg width={W} height={H} className="block" aria-label="Where the trigger could be, before and after the reports">
              <path d={area(pri, Math.max(...Array.from(pri).slice(0, maxX)))} fill="var(--line)" opacity={0.5} />
              <path d={area(post, peak)} fill="var(--reroute)" opacity={0.28} stroke="var(--reroute)" strokeWidth={1.5} />
              <line x1={px(b.lo)} x2={px(b.lo)} y1={4} y2={H - 18} stroke="var(--reroute)" strokeDasharray="3 2" />
              <line x1={px(b.hi)} x2={px(b.hi)} y1={4} y2={H - 18} stroke="var(--reroute)" strokeDasharray="3 2" />
              {[0, 20, 40, 60, 80, 100].map((mm) => (
                <text key={mm} x={px(mm)} y={H - 4} textAnchor="middle" className="fill-ink-muted font-mono text-[10.5px]">
                  {mm}
                </text>
              ))}
            </svg>
          )}
        </div>
        <p className="mt-2 text-[15px] leading-snug">
          Trigger: <b className="font-mono tnum">{Math.round(b.lo)}–{Math.round(b.hi)} mm</b>
          {obs.length ? (
            <>
              {" "}
              after {obs.length} report{obs.length > 1 ? "s" : ""}, <b>{Math.round((1 - width1 / width0) * 100)}% narrower</b> than the starting guess (
              {Math.round(b0.lo)}–{Math.round(b0.hi)} mm).
            </>
          ) : (
            <> is only a guess for a river bridge. Add a report and watch it tighten.</>
          )}
        </p>
      </div>
    </div>
  );
}

const SOURCES = [
  { label: "The Star, 28 Apr 2026: Kimbo-Matangi Road flooded, movement disrupted in Juja", url: "https://www.the-star.co.ke/news/2026-04-28-photos-kimbo-matangi-road-flooded-movement-disrupted" },
  { label: "The Star, 9 Mar 2026: Motorists wade through flooded roads in Juja", url: "https://www.the-star.co.ke/news/2026-03-09-photos-motorists-wade-through-flooded-roads-in-juja" },
  { label: "Kenyans.co.ke, 7 Mar 2026: Kenya Met warns of flooding, more than 80 mm in some areas", url: "https://www.kenyans.co.ke/news/121468-kenya-met-warns-flooding-nairobi-kiambu-and-kajiado-rains-100mm" },
  { label: "Kenya Times, 4 Nov 2023: Ndarugu bridge collapses, Thika–Juja transport disrupted", url: "https://thekenyatimes.com/latest-kenya-times-news/traffic-alert-floods-disrupt-transport-along-thika-juja-road/" },
  { label: "The Star, 27 Aug 2026: Kenya braces for wetter-than-normal October–December rains", url: "https://www.the-star.co.ke/news/2026-08-27-brace-for-wetter-than-normal-october-dec-rains" },
  { label: "FlowSafe (JHUB Hack the Weather)", url: "https://github.com/Skarpia/HacktheWeather" },
  { label: "Google Flood Hub", url: "https://sites.research.google/floods/" },
  { label: "mafuriko", url: "https://mafuriko.co.ke/" },
];

export function How() {
  const s = useStore();
  const g = s.series.gauges.find((x) => !x.unreliable);
  const rain = g ? s.clean.rain[g.id] : new Float64Array(s.series.n);
  const st = s.storms[0];
  const T = (i: number) => s.series.start + i * STEP_MS;
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center gap-3 border-b border-line px-6">
        <Link href="/">
          <Lockup mark={28} word={22} />
        </Link>
        <span className="flex-1" />
        <Link href="/replay" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[14px] font-bold text-ink-muted hover:bg-surface-2 hover:text-ink">
          <IconArrowLeft size={16} aria-hidden /> Back to the replay
        </Link>
      </header>
      <main className="mx-auto max-w-[1080px] px-6 pb-24">
        <section className="grid grid-cols-1 gap-8 py-14 md:grid-cols-[7fr_5fr]">
          <div>
            <h1 className="font-display text-[clamp(44px,6vw,76px)] font-extrabold leading-[0.95]">Each crossing floods at its own rain signature</h1>
            <p className="mt-5 max-w-[56ch] text-[18px] leading-relaxed text-ink-muted">
              One gauge reading every 15 minutes, plus a few dated flood reports, is enough to learn a trigger for each named crossing. Every &ldquo;flooded&rdquo; or &ldquo;clear&rdquo; tap from a rider sharpens it.
            </p>
          </div>
          <div className="self-end border-l-2 border-line pl-6 text-[17px] leading-relaxed text-ink-muted">
            {st && (
              <p>
                The biggest storm in the file fell on <b className="text-ink">{dayLabel(T(st.i0))}</b>, {hhmm(T(st.i0))}–{hhmm(T(st.i1 + 1))}:{" "}
                <b className="text-ink tnum">{fmtMm(st.total)}&nbsp;mm</b>, with <b className="text-ink tnum">{fmtMm(st.peak)}&nbsp;mm</b> in the hardest fifteen minutes.
              </p>
            )}
            <p className="mt-3">
              The county warning said &ldquo;more than 80&nbsp;mm in some areas&rdquo;. Crossing Watch&rsquo;s call for that evening: Kimbo–Matangi likely flooded from 18:00 for two and a half hours; at 20:30 the call eases to wait.
            </p>
          </div>
        </section>

        <section className="border-t border-line py-12">
          <H2 n={1}>One gauge, every 15 minutes</H2>
          <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed text-ink-muted">
            {s.source.kind === "demo"
              ? "Simulated series (the station file isn't loaded)."
              : "The JHUB weather station at JKUAT. Its rain column under-reports about 17×, so we read the gauge's running daily total instead; its second gauge rises with the sun and falls at night, so we ignore it."}
          </p>
          <div className="mt-6 rounded-lg border border-line bg-surface-1 p-4">
            <Hyetograph rain={rain} start={s.series.start} i0={s.stormWindow.i0} i1={s.stormWindow.i1} i={s.stormWindow.i1} height={200} />
          </div>
        </section>

        <section className="border-t border-line py-12">
          <H2 n={2}>Every crossing has a bucket</H2>
          <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed text-ink-muted">
            Rain fills the bucket; it drains by half every so often. That half-life is the crossing&rsquo;s signature: a campus culvert empties in minutes, a road dip in an hour or two, a river bridge over half a day. A crossing floods when its bucket passes its trigger (red dots).
          </p>
          <div className="mt-6 rounded-lg border border-line bg-surface-1 p-4">
            <Signatures />
          </div>
        </section>

        <section className="border-t border-line py-12">
          <H2 n={3}>Reports set the trigger</H2>
          <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed text-ink-muted">
            A &ldquo;clear&rdquo; report at 19 mm says the trigger is above 19; a &ldquo;flooded&rdquo; report at 36 mm says it&rsquo;s below 36. Each report is weighed (riders can be wrong), and the band is where the trigger most likely sits. Try it on a bridge nobody has reported yet:
          </p>
          <div className="mt-8">
            <Learner />
          </div>
        </section>

        <section className="border-t border-line py-12">
          <h2 className="font-display text-[34px] font-bold leading-[1.05]">Honest about the data</h2>
          <ul className="mt-5 grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {[
              ["Triggers start from one storm.", "The Kimbo–Matangi band comes from a single dated news report. Wide bands say so on screen, and every tap narrows them."],
              ["Faulty gauges are caught, not trusted.", "Gaps, spikes, flatlines and counters that run backwards are flagged. A crossing with a silent gauge gets NO CALL, never CROSS."],
              ["Calls err towards caution.", "A flooded report in the last 30 minutes forces at least WAIT. A clear report never forces CROSS."],
              ["Locations are approximate.", "Crossings come from OpenStreetMap; the exact flooded spot on Kimbo–Matangi still needs a rider to pin it."],
            ].map(([a, b]) => (
              <li key={a} className="border-t border-line py-4">
                <p className="text-[16px] font-bold">{a}</p>
                <p className="mt-1 text-[14.5px] leading-snug text-ink-muted">{b}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line py-12">
          <h2 className="font-display text-[34px] font-bold leading-[1.05]">What exists today</h2>
          <table className="mt-5 w-full text-left text-[14.5px]">
            <thead>
              <tr className="label text-ink-muted">
                <th className="py-2 pr-4 font-bold">Source</th>
                <th className="py-2 pr-4 font-bold">Covers</th>
                <th className="py-2 pr-4 font-bold">Names a crossing?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-y border-line">
              {[
                ["County warning (Kenya Met)", "Whole county, ‘some areas’, about a day ahead", "No"],
                ["Google Flood Hub", "20×20 km cells, up to 24 h ahead, dense areas only", "No"],
                ["mafuriko", "246 fixed Nairobi hotspots", "No, and not Juja"],
                ["FlowSafe", "Flood risk per farm from the same JKUAT gauge", "No"],
                ["Crossing Watch", "Six named Juja crossings, every 15 minutes, with a detour", "Yes"],
              ].map(([a, b, c]) => (
                <tr key={a} className={cx(a === "Crossing Watch" && "font-bold")}>
                  <td className="py-2.5 pr-4">{a}</td>
                  <td className="py-2.5 pr-4 text-ink-muted">{b}</td>
                  <td className="py-2.5 pr-4">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-1 gap-8 border-t border-line py-12 md:grid-cols-[7fr_5fr]">
          <div>
            <h2 className="font-display text-[34px] font-bold leading-[1.05]">Why now</h2>
            <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-ink-muted">
              Kenya Met expects wetter-than-normal October–December rain in counties including Kiambu, starting in the second and third weeks of October. A pilot needs three boda stages, JKUAT, one gauge and riders willing to tap.
            </p>
            <Link href="/replay" className="mt-5 inline-flex h-11 items-center rounded-md bg-accent px-5 text-[15px] font-bold text-accent-ink hover:bg-accent-hover">
              Watch the 20 March replay
            </Link>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-ink">Sources</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
              {SOURCES.map((x) => (
                <li key={x.url}>
                  <a href={x.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                    {x.label} <IconExternalLink size={12} className="mt-1 shrink-0" aria-hidden />
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-1.5 text-ink-muted">
                <GGauge size={14} /> Rain: Conduit@Empathy station, JKUAT. Map: © OpenStreetMap contributors.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
