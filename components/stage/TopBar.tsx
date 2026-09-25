"use client";

import { IconDeviceMobile, IconFileUpload, IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GGauge } from "@/components/brand/glyphs";
import { Lockup } from "@/components/brand/marks";
import { Button, cx, Kbd, Segmented } from "@/components/ui/primitives";
import { dayLabel } from "@/lib/model/time";
import { STEP_MS } from "@/lib/model/types";
import { HAS_STATION, useStore } from "@/lib/state/store";
import { DataHealth } from "./DataHealth";

function Popover({ open, onClose, children, align = "right", width = 320 }: { open: boolean; onClose: () => void; children: ReactNode; align?: "left" | "right"; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      className={cx(
        "absolute top-full z-40 mt-2 origin-top rounded-lg border border-line bg-surface-1 p-4 text-[14px] shadow-pop [animation:pop_200ms_var(--ease-out-quint)]",
        align === "right" ? "right-0" : "left-0",
      )}
      style={{ width }}
    >
      {children}
    </div>
  );
}

export function DataSourceChip() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const imp = s.importState;
  const flags = s.clean.flags.length;
  const T = (i: number) => s.series.start + i * STEP_MS;
  const label =
    imp.status === "importing" ? `Reading ${imp.file}…` : imp.status === "error" ? `Couldn't read ${imp.file}` : s.source.kind === "imported" ? `${s.source.fileName}` : s.series.label;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (imp.status === "error") setOpen(true);
  }, [imp.status]);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={imp.status === "importing" || undefined}
        className={cx(
          "inline-flex h-8 max-w-[360px] items-center gap-2 rounded-sm border px-2.5 text-[13px] font-bold transition-colors",
          imp.status === "error" ? "border-reroute-text text-reroute-text" : "border-line bg-surface-1 text-ink hover:border-line-strong",
        )}
      >
        <span aria-hidden className={cx("size-2 shrink-0 rounded-full", s.source.kind === "demo" && "hatch ring-1 ring-nocall")} style={{ background: s.source.kind === "demo" ? undefined : "var(--accent)" }} />
        <GGauge size={15} className="shrink-0 text-ink-muted" />
        <span className="truncate">{label}</span>
        {flags > 0 && imp.status === "idle" && <span className="shrink-0 font-normal text-wait-text">· {flags} flag{flags > 1 ? "s" : ""}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width={380}>
        <p className="font-bold">{s.series.label}</p>
        <p className="mt-0.5 text-ink-muted">
          {dayLabel(T(0))} → {dayLabel(T(s.series.n - 1))} · {s.series.n.toLocaleString()} steps of 15 min
        </p>
        <p className="mt-2 leading-snug text-ink-muted">
          {s.source.kind === "demo"
            ? "Simulated, shaped like a March storm in Juja, with planted gauge faults. Every call on screen is computed from it."
            : s.source.kind === "station"
              ? "JHUB Conduit weather station at JKUAT (the same gauge FlowSafe uses), 6–24 Mar 2026, read through its public API."
              : `Imported from ${s.source.fileName}.`}
        </p>
        <div className="mt-2 max-h-[40vh] overflow-y-auto">
          <DataHealth />
        </div>
        {imp.status === "error" && <p className="mt-3 rounded-md bg-reroute/10 p-2 text-[13px] leading-snug text-reroute-text">{imp.message}</p>}
        <div className="mt-3 flex flex-col gap-2">
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) s.importFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="primary" size="sm" onClick={() => file.current?.click()}>
            <IconFileUpload size={16} aria-hidden /> Load station CSV…
          </Button>
          <p className="text-[12px] text-ink-muted">Or drop a CSV anywhere on this page. Any time + rain columns work; JHUB and TAHMO exports are recognised.</p>
          {HAS_STATION && s.source.kind !== "station" && (
            <Button size="sm" onClick={() => s.setDataset("station")}>
              Use JKUAT station data
            </Button>
          )}
          {s.source.kind !== "demo" && (
            <Button size="sm" variant="ghost" onClick={() => s.setDataset("simulated")}>
              Use simulated series
            </Button>
          )}
        </div>
      </Popover>
    </div>
  );
}

function QrButton() {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    if (!open || origin) return;
    fetch("/api/lan")
      .then((r) => r.json())
      .then((j: { origin: string }) => setOrigin(j.origin))
      .catch(() => setOrigin(window.location.origin));
  }, [open, origin]);
  const url = origin ? `${origin}/app?follow=1` : "";
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <IconDeviceMobile size={17} aria-hidden /> On your phone
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} width={260}>
        <p className="font-bold">Open the rider app</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">It follows this replay. Tap Flooded or Clear and watch the post here change.</p>
        <div className="mt-3 flex justify-center rounded-md bg-white p-3">{url ? <QRCodeSVG value={url} size={180} fgColor="#0E1A20" bgColor="#FFFFFF" /> : <div className="sk size-[180px]" />}</div>
        <p className="mt-2 break-all font-mono text-[11.5px] text-ink-muted">{url}</p>
      </Popover>
    </div>
  );
}

export function TopBar({ onPalette, compact }: { onPalette: () => void; compact?: boolean }) {
  const s = useStore();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas px-4 lg:px-6">
      <Link href="/" className="rounded-sm">
        <Lockup mark={28} word={22} />
      </Link>
      {!compact && (
        <>
          <span aria-hidden className="h-5 w-px bg-line" />
          <span className="text-[14px] text-ink-muted">Juja, Kiambu</span>
        </>
      )}
      <span className="flex-1" />
      <DataSourceChip />
      <Segmented
        label="Language"
        value={s.lang}
        onChange={s.setLang}
        options={[
          { value: "en", label: "EN", title: "English (L)" },
          { value: "sw", label: "SW", title: "Kiswahili (L)" },
        ]}
      />
      {!compact && <QrButton />}
      <Button size="sm" variant="ghost" onClick={onPalette} aria-label="Search and commands">
        <IconSearch size={16} aria-hidden />
        {!compact && <Kbd>⌘K</Kbd>}
      </Button>
    </header>
  );
}
