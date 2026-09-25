import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Report } from "@/lib/model/types";

/**
 * Shared report store for the demo: module memory, mirrored to .data/reports.json
 * when the filesystem is writable (local dev / `next start`). On serverless each
 * instance has its own memory: fine for one presenter, swap for a KV store to scale.
 */
const FILE = join(process.cwd(), ".data", "reports.json");
const MAX = 2000;

const g = globalThis as unknown as { __cwReports?: Report[]; __cwLoaded?: boolean };

async function load(): Promise<Report[]> {
  if (!g.__cwLoaded) {
    g.__cwLoaded = true;
    try {
      g.__cwReports = JSON.parse(await readFile(FILE, "utf8"));
    } catch {
      g.__cwReports = [];
    }
  }
  return (g.__cwReports ??= []);
}

async function persist() {
  try {
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    await writeFile(FILE, JSON.stringify(g.__cwReports ?? []));
  } catch {
    /* read-only filesystem: memory only */
  }
}

export async function listReports(): Promise<Report[]> {
  return [...(await load())];
}

export async function addReport(r: Report): Promise<Report> {
  const list = await load();
  if (!list.some((x) => x.id === r.id)) {
    list.push(r);
    if (list.length > MAX) list.splice(0, list.length - MAX);
    await persist();
  }
  return r;
}

export async function removeReport(id: string) {
  const list = await load();
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) {
    list.splice(i, 1);
    await persist();
  }
}

export async function clearReports() {
  await load();
  g.__cwReports = [];
  await persist();
}

export function validateReport(x: unknown): Report | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length > 64) return null;
  if (typeof r.crossingId !== "string" || !/^[a-z0-9-]{1,48}$/.test(r.crossingId)) return null;
  if (typeof r.t !== "number" || !Number.isFinite(r.t)) return null;
  if (r.status !== "flooded" && r.status !== "clear") return null;
  const device = typeof r.device === "string" ? r.device.slice(0, 32) : undefined;
  return { id: r.id, crossingId: r.crossingId, t: r.t, status: r.status, source: "rider", device };
}
