"use client";

import { IconArrowRight, IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import geoJson from "@/data/geo/juja.json";
import { GGauge } from "@/components/brand/glyphs";
import { Lockup } from "@/components/brand/marks";
import { RiderApp } from "@/components/rider/RiderApp";
import { PhoneFrame } from "@/components/stage/PhoneFrame";
import { cx } from "@/components/ui/primitives";
import { DepthPost } from "@/components/viz/DepthPost";
import { Hyetograph } from "@/components/viz/Hyetograph";
import { parseEat } from "@/lib/model/time";
import { band, posterior, prior } from "@/lib/model/trigger";
import { STEP_MS } from "@/lib/model/types";
import { StoreProvider, useStore } from "@/lib/state/store";
import { fmtMm } from "@/lib/view";
import { CallRibbons, useLandingWorld } from "./CallRibbons";

const CONTRACT = `<!--
THESIS: The county says "more than 80 mm in some areas"; this page names the crossing. It refuses the SaaS hero (headline, three feature cards, CTA): the first viewport is the product making a call on the real storm.
OWN-WORLD: Drift Post. Overcast rain-light grey, storm ink, rain blue for water only; the decision sign is the one loud surface (green / amber / red); depth posts; Barlow Condensed road-sign type over Atkinson Hyperlegible; Juja's real rivers as the only texture.
STORY: A judge reads the headline, watches the phone go red at Kimbo-Matangi on 20 March, sees every crossing's call over the evening, learns the three-part mechanism, reads what is and isn't known, then opens the replay or the rider app.
FIRST VIEWPORT: Left 7/12: H1 (Barlow 800, up to 96px), one-sentence lead, primary "Watch the 20 March replay", secondary "Open the rider app", data provenance line. Right 5/12: the live rider app in a device frame, looping the storm, over the Ndarugu/Thiririka/Ruiru river lines.
FORM: live-product hero (owner's hackathon-ui blueprint j); structure pinned by the owner's skill, so no concept-seed roll. Code-led.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

interface Geo {
  width: number;
  height: number;
  rivers: { name: string; kind: string; d: string }[];
}
const geo = geoJson as unknown as Geo;

/** Juja's real river network, drawn once as the page's only texture. */
function Rivers({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${geo.width} ${geo.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      {geo.rivers
        .filter((r) => r.name)
        .map((r, k) => (
          <path key={k} d={r.d} fill="none" stroke="var(--rain)" strokeWidth={r.kind === "river" ? 2.2 : 1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
    </svg>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <nav className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-5 md:px-8" aria-label="Main">
        <Link href="/" className="shrink-0 rounded-sm" aria-label="Crossing Watch home">
          <Lockup mark={26} word={21} />
        </Link>
        <span className="flex-1" />
        <div className="hidden items-center gap-1 text-[15px] font-bold text-ink-muted md:flex">
          <a href="#how" className="rounded-md px-3 py-2 hover:bg-surface-2 hover:text-ink">
            How it works
          </a>
          <Link href="/how" className="rounded-md px-3 py-2 hover:bg-surface-2 hover:text-ink">
            The method
          </Link>
          <Link href="/app" className="rounded-md px-3 py-2 hover:bg-surface-2 hover:text-ink">
            Rider app
          </Link>
        </div>
        <Link href="/replay" className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border-2 border-ink px-4 text-[15px] font-bold text-ink transition-colors hover:bg-ink hover:text-canvas">
          <span className="sm:hidden">Replay</span>
          <span className="hidden sm:inline">Watch the replay</span>
        </Link>
      </nav>
    </header>
  );
}

/** Keeps the hero loop short and lets the red call sit long enough to read. */
function HeroDirector() {
  const s = useStore();
  const held = useRef(false);
  const { clock, stormWindow, storms } = s;
  const storm = storms[0];
  useEffect(() => {
    if (storm) s.setWindow(stormWindow.i0 + 4, Math.min(s.series.n - 1, storm.i1 + 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const call = s.models["kimbo-matangi"]?.calls[clock.i]?.call;
  useEffect(() => {
    if (clock.i <= clock.i0 + 1) held.current = false;
    if (call === "reroute" && !held.current && clock.playing) {
      held.current = true;
      s.pause();
      const id = window.setTimeout(() => s.play(), 4200);
      return () => window.clearTimeout(id);
    }
  }, [call, clock.i, clock.i0, clock.playing, s]);
  return null;
}

function Provenance({ className }: { className?: string }) {
  return (
    <p className={cx("flex items-center gap-2 text-[14px] text-ink-muted", className)}>
      <GGauge size={16} className="shrink-0 text-rain" />
      Runs on the JKUAT weather station&rsquo;s real 15-minute rain data, 6&ndash;24 March 2026.
    </p>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-12 px-5 pb-20 pt-12 md:px-8 lg:min-h-[calc(100dvh-64px)] lg:grid-cols-12 lg:gap-8 lg:py-10">
      <div className="lg:col-span-7">
        <h1 className="font-display text-[clamp(44px,7vw,96px)] font-extrabold leading-[0.92] tracking-[-0.01em] text-ink">Name the crossing, not the county.</h1>
        <p className="mt-6 max-w-[34ch] text-[clamp(18px,1.6vw,21px)] leading-relaxed text-ink-muted">
          When a storm starts in Juja, riders get &ldquo;more than 80&nbsp;mm in some areas&rdquo;. Crossing Watch turns one rain gauge into a call for each named crossing: <b className="text-ink">cross</b>, <b className="text-ink">wait</b> or{" "}
          <b className="text-ink">reroute</b>, and for how long.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/replay"
            className="group inline-flex h-12 items-center gap-2 rounded-md bg-accent px-5 text-[16px] font-bold text-accent-ink transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[.97]"
          >
            Watch the 20 March replay
            <IconArrowRight size={18} className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link href="/app" className="inline-flex h-12 items-center rounded-md border border-line bg-surface-1 px-5 text-[16px] font-bold text-ink transition-colors hover:border-line-strong hover:bg-surface-2">
            Open the rider app
          </Link>
        </div>
        <Provenance className="mt-6 hidden lg:flex" />
      </div>
      <div className="relative lg:col-span-5">
        <Rivers className="pointer-events-none absolute -inset-x-24 -inset-y-10 h-[calc(100%+80px)] w-[calc(100%+192px)] opacity-[0.16]" />
        <div className="relative mx-auto h-[500px] max-w-[360px] sm:h-[600px] lg:h-[min(78dvh,720px)] lg:min-h-[560px]">
          <StoreProvider options={{ autoplay: true, loop: true, quiet: true, selected: "kimbo-matangi" }}>
            <HeroDirector />
            <PhoneFrame>
              <RiderApp framed pinnedId="kimbo-matangi" />
            </PhoneFrame>
          </StoreProvider>
        </div>
        <Provenance className="relative mt-6 justify-center lg:hidden" />
      </div>
    </section>
  );
}

function Proof() {
  const { storm, series, simulated } = useLandingWorld();
  const T = (i: number) => series.start + i * STEP_MS;
  return (
    <section className="border-y border-line bg-surface-1">
      <div className="mx-auto max-w-[1240px] px-5 py-24 md:px-8">
        <h2 className="max-w-[20ch] font-display text-[clamp(36px,4.4vw,60px)] font-bold leading-[1] text-ink">
          Friday 20 March, 17:15. The rain hits JKUAT.
        </h2>
        <p className="mt-5 max-w-[62ch] text-[18px] leading-relaxed text-ink-muted">
          {storm ? `${fmtMm(storm.total)} mm fell in under three hours, ${fmtMm(storm.peak)} mm of it in fifteen minutes.` : ""} Each row below is the call one crossing would have given a rider, every fifteen minutes, on the real gauge data.
          {simulated ? " (Simulated series: the station file isn't loaded.)" : ""}
        </p>
        <div className="mt-12">
          <CallRibbons />
        </div>
        <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-6 border-t border-line pt-8 text-[16px] leading-snug md:grid-cols-3">
          <div>
            <dt className="font-bold text-ink">Kimbo–Matangi goes red at 18:00</dt>
            <dd className="mt-1 text-ink-muted">&ldquo;Likely flooded for two and a half hours. Use Theta Road.&rdquo; At 20:30, right on time, the call eases to wait; by 21:15 it&rsquo;s cross.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">The campus culvert drains first</dt>
            <dd className="mt-1 text-ink-muted">JKUAT&rsquo;s Technology Street clears an hour before Kimbo–Matangi, on the same rain.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">The river is slow</dt>
            <dd className="mt-1 text-ink-muted">The Ndarugu bridge rises last and stays up past midnight, long after the rain stops at {storm ? hhmmSafe(T(storm.i1 + 1)) : ""}.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function hhmmSafe(t: number) {
  const d = new Date(t + 3 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function How() {
  const { series, clean, models, gid, w } = useLandingWorld();
  const at = (eatTime: string) => Math.round((parseEat(eatTime) - series.start) / STEP_MS) - 1;
  const k1830 = at("2026-03-20T18:30");
  const k1930 = at("2026-03-20T19:30");
  const posts = ["jkuat-culvert", "kimbo-matangi", "ndarugu"].map((id) => models[id]).filter(Boolean);
  const nd = models["ndarugu"];
  const after = useMemo(() => {
    if (!nd) return null;
    const obs = [...nd.obs.map((o) => ({ level: o.level, status: o.status, weight: o.weight })), { level: nd.level[k1930], status: "flooded" as const, weight: 0.8 }];
    return band(posterior(prior(nd.crossing.priorMedian), obs));
  }, [nd, k1930]);
  const narrower = nd && after ? Math.round((1 - (after.hi - after.lo) / (nd.band.hi - nd.band.lo)) * 100) : 0;
  const steps = [
    {
      title: "One gauge, every 15 minutes.",
      body: "The JKUAT station's running daily total, read carefully: its raw rain column under-reports about 17×, and its second gauge follows the sun, so we set it aside.",
      visual: (
        <div className="h-[132px] w-full">
          <Hyetograph rain={clean.rain[gid]} start={series.start} i0={w.i0} i1={w.i1} i={w.i1} height={132} minimal />
        </div>
      ),
    },
    {
      title: "A bucket for every crossing.",
      body: "Rain fills it and it drains at the crossing's own speed: 45 minutes for a campus culvert, ten hours for a river bridge. Same storm, different signatures.",
      visual: (
        <div className="flex h-[132px] items-end justify-center gap-8">
          {posts.map((m) => (
            <div key={m.crossing.id} className="flex flex-col items-center gap-1.5">
              <DepthPost variant="compact" level={m.level[k1830]} band={m.band} uncertain={!m.obs.length} max={80} />
              <span className="text-[12px] font-bold text-ink-muted">{m.crossing.tag}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Riders set the trigger.",
      body: `A "flooded" tap at a known water level cuts the range where the trigger can be. One report at the Ndarugu bridge narrows it ${narrower}%.`,
      visual: nd && after && (
        <div className="flex h-[132px] items-end justify-center gap-10">
          <div className="flex flex-col items-center gap-1.5">
            <DepthPost variant="compact" level={nd.level[k1930]} band={nd.band} uncertain />
            <span className="text-[12px] font-bold text-ink-muted">before</span>
          </div>
          <IconArrowRight size={20} className="mb-16 text-ink-muted" aria-hidden />
          <div className="flex flex-col items-center gap-1.5">
            <DepthPost variant="compact" level={nd.level[k1930]} band={after} ticks={[{ id: "tap", level: nd.level[k1930], status: "flooded", fresh: true }]} />
            <span className="text-[12px] font-bold text-ink-muted">after one report</span>
          </div>
        </div>
      ),
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-[1240px] scroll-mt-20 px-5 py-28 md:px-8">
      <h2 className="max-w-[18ch] font-display text-[clamp(36px,4.4vw,60px)] font-bold leading-[1] text-ink">Three things make the call.</h2>
      <ol className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
        {steps.map((s, k) => (
          <li key={s.title} className={cx("flex flex-col", k > 0 && "md:pl-10", k < 2 && "md:pr-10")}>
            <div className="flex h-[150px] w-full items-end">{s.visual}</div>
            <h3 className="mt-8 font-display text-[28px] font-bold leading-tight text-ink">{s.title}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-12 text-[16px]">
        <Link href="/how" className="font-bold text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
          The full method, with a trigger you can train yourself&nbsp;<IconArrowRight size={16} aria-hidden className="inline align-[-3px]" />
        </Link>
      </p>
    </section>
  );
}

function Honest() {
  const known = [
    "Rain: the JKUAT station's own readings, 6–24 March 2026.",
    "Kimbo–Matangi flooded after the March rain (The Star, 9 Mar 2026). That report sets its trigger.",
    "Rivers, roads and detours: OpenStreetMap, routed at boda speed.",
  ];
  const unknown = [
    "Triggers start from a single storm. Wide, dashed bands on screen say so, and every tap narrows them.",
    "The exact flooded spot on Kimbo–Matangi, and the route riders call Theta Road, still need a rider to pin them.",
    "No rider survey yet. The Kiswahili copy needs a native speaker's review.",
  ];
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 px-5 py-24 md:grid-cols-12 md:px-8">
        <h2 className="font-display text-[clamp(32px,3.4vw,46px)] font-bold leading-[1.02] text-ink md:col-span-4">What we know, and what we don&rsquo;t yet.</h2>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:col-span-8">
          {[
            { h: "Real", items: known },
            { h: "Not yet", items: unknown },
          ].map((g) => (
            <div key={g.h}>
              <h3 className="text-[17px] font-bold text-ink">{g.h}</h3>
              <ul className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink-muted">
                {g.items.map((t) => (
                  <li key={t} className="border-t border-line pt-3">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Close() {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);
  return (
    <section className="relative overflow-hidden border-t border-line bg-ink text-canvas">
      <Rivers className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22]" />
      <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-end gap-12 px-5 py-24 md:grid-cols-12 md:px-8">
        <div className="md:col-span-8">
          <h2 className="max-w-[16ch] font-display text-[clamp(40px,5vw,72px)] font-extrabold leading-[0.95]">Ready before the October rains.</h2>
          <p className="mt-6 max-w-[56ch] text-[18px] leading-relaxed text-canvas/75">
            Kenya Met expects wetter-than-normal rain in Kiambu from the second and third weeks of October. A pilot needs three boda stages, JKUAT, one gauge and riders willing to tap.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/replay" className="inline-flex h-12 items-center gap-2 rounded-md bg-canvas px-5 text-[16px] font-bold text-ink transition-colors hover:bg-surface-2">
              Watch the replay <IconArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/app" className="inline-flex h-12 items-center rounded-md border border-canvas/35 px-5 text-[16px] font-bold text-canvas transition-colors hover:border-canvas/70">
              Open the rider app
            </Link>
          </div>
        </div>
        <div className="hidden md:col-span-4 md:flex md:flex-col md:items-end">
          <div className="rounded-lg bg-canvas p-3">{origin ? <QRCodeSVG value={`${origin}/app`} size={148} fgColor="#0E1A20" bgColor="#E3E7E7" /> : <div className="size-[148px]" />}</div>
          <p className="mt-3 text-[14px] text-canvas/70">Scan for the rider app</p>
        </div>
      </div>
    </section>
  );
}

const SOURCES = [
  { label: "The Star, 28 Apr 2026", url: "https://www.the-star.co.ke/news/2026-04-28-photos-kimbo-matangi-road-flooded-movement-disrupted" },
  { label: "The Star, 9 Mar 2026", url: "https://www.the-star.co.ke/news/2026-03-09-photos-motorists-wade-through-flooded-roads-in-juja" },
  { label: "Kenya Met via Kenyans.co.ke, 7 Mar 2026", url: "https://www.kenyans.co.ke/news/121468-kenya-met-warns-flooding-nairobi-kiambu-and-kajiado-rains-100mm" },
  { label: "Kenya Times, 4 Nov 2023", url: "https://thekenyatimes.com/latest-kenya-times-news/traffic-alert-floods-disrupt-transport-along-thika-juja-road/" },
  { label: "The Star, 27 Aug 2026", url: "https://www.the-star.co.ke/news/2026-08-27-brace-for-wetter-than-normal-october-dec-rains" },
];

function Footer() {
  return (
    <footer className="bg-ink text-canvas/70">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 border-t border-canvas/15 px-5 py-10 text-[13.5px] md:flex-row md:items-start md:justify-between md:px-8">
        <p className="max-w-[46ch] leading-relaxed">
          Crossing Watch, Juja, Kiambu. Map data © OpenStreetMap contributors. Rain data: JHUB Africa Conduit station at JKUAT. Calls are the model&rsquo;s replay of historical data, not live warnings.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-canvas/30 underline-offset-4 hover:text-canvas hover:decoration-canvas/70">
                {s.label} <IconExternalLink size={12} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
      <Nav />
      <main>
        <Hero />
        <Proof />
        <How />
        <Honest />
        <Close />
      </main>
      <Footer />
    </div>
  );
}
