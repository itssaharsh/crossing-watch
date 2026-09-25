"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Kbd } from "@/components/ui/primitives";
import { HAS_STATION, useStore } from "@/lib/state/store";

function Item({ children, onSelect, kbd }: { children: ReactNode; onSelect: () => void; kbd?: string }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-[14.5px] text-ink data-[selected=true]:bg-surface-2"
    >
      <span className="truncate">{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </Command.Item>
  );
}

const GROUP = "[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-ink-muted";

export function CommandPalette({ open, onClose, onLoadCsv }: { open: boolean; onClose: () => void; onLoadCsv: () => void }) {
  const s = useStore();
  const router = useRouter();
  if (!open) return null;
  const run = (f: () => void) => () => {
    f();
    onClose();
  };
  const sel = s.crossings.find((c) => c.id === s.selectedId);
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 px-4" onPointerDown={onClose}>
      <Command
        label="Commands"
        loop
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="mx-auto mt-[12vh] w-full max-w-[640px] overflow-hidden rounded-lg border border-line bg-surface-1 shadow-pop"
      >
        <Command.Input autoFocus placeholder="Type a command or a crossing…" className="h-12 w-full border-b border-line bg-transparent px-4 text-[16px] text-ink outline-none placeholder:text-ink-muted" />
        <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-[14px] text-ink-muted">Nothing matches. Try a crossing name, or &ldquo;storm&rdquo;.</Command.Empty>
          <Command.Group heading="Replay" className={GROUP}>
            <Item onSelect={run(s.toggle)} kbd="Space">
              {s.clock.playing ? "Pause replay" : "Play replay"}
            </Item>
            <Item onSelect={run(() => s.jumpToStorm())} kbd="J">
              Jump to the biggest storm
            </Item>
            <Item onSelect={run(() => s.seek(s.clock.i0))} kbd="R">
              Rewind to window start
            </Item>
          </Command.Group>
          <Command.Group heading="Crossings" className={GROUP}>
            {s.crossings.map((c) => (
              <Item
                key={c.id}
                onSelect={run(() => {
                  s.select(c.id);
                  s.setPhone({ name: "detail", id: c.id });
                })}
              >
                {c.name}
              </Item>
            ))}
          </Command.Group>
          {sel && (
            <Command.Group heading={`Report at ${sel.name}`} className={GROUP}>
              <Item onSelect={run(() => s.report(sel.id, "flooded"))}>It&rsquo;s flooded</Item>
              <Item onSelect={run(() => s.report(sel.id, "clear"))}>It&rsquo;s clear</Item>
            </Command.Group>
          )}
          <Command.Group heading="Data" className={GROUP}>
            <Item onSelect={run(onLoadCsv)}>Load station CSV…</Item>
            {HAS_STATION && s.source.kind !== "station" && <Item onSelect={run(() => s.setDataset("station"))}>Use JKUAT station data</Item>}
            {s.source.kind !== "demo" && <Item onSelect={run(() => s.setDataset("simulated"))}>Use simulated series</Item>}
          </Command.Group>
          <Command.Group heading="App" className={GROUP}>
            <Item onSelect={run(() => s.setLang(s.lang === "en" ? "sw" : "en"))} kbd="L">
              {s.lang === "en" ? "Switch to Kiswahili" : "Switch to English"}
            </Item>
            <Item onSelect={run(() => router.push("/app"))}>Open the rider app</Item>
            <Item onSelect={run(() => router.push("/how"))}>How a trigger is learned</Item>
            <Item
              onSelect={run(() => {
                s.resetDemo();
                toast("Demo reset: reports cleared, replay rewound");
              })}
              kbd="⇧⌘R"
            >
              Reset demo
            </Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
