import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bucket, decayFor, warmStart } from "./bucket";
import { assignGauges, parseStationCsv } from "./csv";
import { applyHysteresis, buildModels, humanDuration, type StepCall } from "./decide";
import { qc } from "./faults";
import { findStorms } from "./storms";
import { parseEat } from "./time";
import { band, posterior, prior } from "./trigger";
import { STEP_MS, type Crossing, type Report, type Series } from "./types";

const T0 = parseEat("2026-03-18T00:00");

function series(rain: Record<string, (number | null)[]>, gauges = Object.keys(rain)): Series {
  const n = Object.values(rain)[0].length;
  return {
    source: "simulated",
    label: "test",
    start: T0,
    n,
    gauges: gauges.map((id, k) => ({ id, name: id, lat: -1.1 + k * 0.01, lon: 37 })),
    rain,
  };
}

const crossing = (over: Partial<Crossing> = {}): Crossing => ({
  id: "x",
  name: "X",
  road: "",
  river: "",
  kind: "drift",
  lat: -1.1,
  lon: 37,
  gaugeId: "A",
  halfLifeH: 1.5,
  priorMedian: 30,
  detours: [],
  ...over,
});

describe("bucket", () => {
  it("drains by half every half-life", () => {
    const k = decayFor(1.5);
    expect(Math.pow(k, 6)).toBeCloseTo(0.5, 10); // 6 × 15 min = 1.5 h
    const s = bucket([10, 0, 0, 0, 0, 0, 0], 1.5);
    expect(s[0]).toBe(10);
    expect(s[6]).toBeCloseTo(5, 10);
  });
  it("warm-starts from rain before the series", () => {
    expect(warmStart(64, 3, 9)).toBeCloseTo(8, 10);
  });
});

describe("trigger posterior", () => {
  it("a flooded and a clear report bracket the trigger", () => {
    const pri = prior(30);
    const post = posterior(pri, [
      { level: 19, status: "clear", weight: 1 },
      { level: 36, status: "flooded", weight: 1 },
    ]);
    const b = band(post);
    expect(b.lo).toBeGreaterThan(15);
    expect(b.hi).toBeLessThan(40);
    expect(b.hi - b.lo).toBeLessThan(band(pri).hi - band(pri).lo);
  });
  it("every extra report narrows the band", () => {
    const pri = prior(50);
    const one = band(posterior(pri, [{ level: 53, status: "flooded", weight: 0.8 }]));
    const two = band(posterior(pri, [
      { level: 53, status: "flooded", weight: 0.8 },
      { level: 35, status: "clear", weight: 0.8 },
    ]));
    expect(two.hi - two.lo).toBeLessThan(one.hi - one.lo);
  });
});

describe("gauge quality control", () => {
  it("flags an isolated spike, a gap, and a clogged gauge", () => {
    const n = 40;
    const a: (number | null)[] = new Array(n).fill(0);
    const b: (number | null)[] = new Array(n).fill(0);
    a[3] = 36.4; // lone burst
    a[10] = a[11] = a[12] = null; // logger offline
    for (let i = 20; i < 30; i++) a[i] = 2; // real rain at A…
    // …while B reads zero throughout (clogged funnel)
    const clean = qc(series({ A: a, B: b }));
    const kinds = clean.flags.map((f) => `${f.gaugeId}:${f.kind}`);
    expect(kinds).toContain("A:spike");
    expect(kinds).toContain("A:gap");
    expect(kinds).toContain("B:flatline");
    expect(clean.rain.A[3]).toBe(0); // spike removed
    expect(clean.rain.B[25]).toBe(2); // flatline filled from A
  });
  it("never uses an unreliable gauge to fill a good one", () => {
    const s = series({ A: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], B: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] });
    s.gauges[1].unreliable = "counter runs backwards";
    const clean = qc(s);
    expect(Array.from(clean.rain.A)).toEqual(new Array(10).fill(0));
    expect(clean.flags.some((f) => f.gaugeId === "B" && f.kind === "unreliable")).toBe(true);
  });
});

describe("decisions", () => {
  // 3 h dry, a 2-h storm, then dry
  const rain = [...new Array(12).fill(0), 2, 5, 9, 12, 10, 8, 5, 3, 2, 1, ...new Array(40).fill(0)];
  const s = series({ A: rain });
  const clean = qc(s);
  const X = crossing({ detours: [{ via: "Theta Road", crossingId: "theta", extraMin: 7 }] });
  const THETA = crossing({ id: "theta", name: "Theta", kind: "high-bridge", halfLifeH: 3, priorMedian: 90 });
  const reports: Report[] = [{ id: "r", crossingId: "x", t: T0 - 86_400_000, status: "flooded", source: "seed" }];

  it("goes red and routes via a clear detour when the bucket passes the trigger", () => {
    const m = buildModels(s, clean, [X, THETA], reports);
    const calls = m.x.calls.map((c) => c.call);
    expect(calls.slice(0, 12).every((c) => c === "cross")).toBe(true);
    const k = calls.indexOf("reroute");
    expect(k).toBeGreaterThan(12);
    expect(X.detours[m.x.calls[k].detourIdx!].via).toBe("Theta Road");
    expect(m.theta.calls[k].call).toBe("cross");
    expect(calls.at(-1)).toBe("cross"); // clears again
  });

  it("waits instead of rerouting when the detour is also flooded", () => {
    const LOW = { ...THETA, priorMedian: 15, halfLifeH: 1.5 };
    const m = buildModels(s, clean, [X, LOW], reports);
    expect(m.x.calls.some((c) => c.call === "reroute")).toBe(false);
    expect(m.x.calls.some((c) => c.call === "wait" && c.reason === "clears_at")).toBe(true);
  });

  it("never says CROSS while the gauge is silent", () => {
    const gap = [...rain];
    for (let i = 30; i < 36; i++) gap[i] = null;
    const g = series({ A: gap });
    const m = buildModels(g, qc(g), [X, THETA], reports);
    for (let i = 30; i < 36; i++) expect(m.x.calls[i].call).toBe("nocall");
  });

  it("a fresh flooded report forces at least WAIT; a clear one never forces CROSS", () => {
    const dry = series({ A: new Array(20).fill(0) });
    const tap: Report = { id: "t", crossingId: "x", t: T0 + 10 * STEP_MS + 1000, status: "flooded", source: "rider" };
    const m = buildModels(dry, qc(dry), [X, THETA], [tap]);
    expect(m.x.calls[10].call).toBe("wait");
    expect(m.x.calls[10].reason).toBe("reported");
    expect(m.x.calls[19].call).toBe("cross"); // 30+ min later, back to the model
  });

  it("holds an improving call for two steps (no flicker)", () => {
    const mk = (call: StepCall["call"]): StepCall => ({ call, reason: "clear", p: 0, level: 0, tClearMin: null, tFloodMin: null, detourIdx: null, reportAgoMin: null });
    const out = applyHysteresis([mk("reroute"), mk("wait"), mk("reroute"), mk("wait"), mk("wait"), mk("cross")]).map((c) => c.call);
    expect(out).toEqual(["reroute", "reroute", "reroute", "reroute", "wait", "wait"]);
  });

  it("says durations the way a rider would", () => {
    expect(humanDuration(22)).toEqual({ value: 20, unit: "min" });
    expect(humanDuration(120)).toEqual({ value: 2, unit: "h" });
    expect(humanDuration(165)).toEqual({ value: 3, unit: "h" });
  });
});

describe("station CSV import", () => {
  it("reads the JKUAT Conduit export from its running daily total and ignores the faulty gauge", () => {
    const text = readFileSync(join(process.cwd(), "data/fixtures/jkuat-conduit-2026-03.csv"), "utf8");
    const { series: s } = parseStationCsv(text, "jkuat.csv");
    const rg1 = s.rain.rg1.reduce<number>((a, v) => a + (v ?? 0), 0);
    expect(rg1).toBeGreaterThan(170);
    expect(rg1).toBeLessThan(190);
    expect(s.gauges.find((g) => g.id === "rg2")?.unreliable).toBeTruthy();
    const storm = findStorms(qc(s).rain.rg1)[0];
    expect(storm.total).toBeGreaterThan(45);
    expect(new Date(s.start + storm.i0 * STEP_MS + 3 * 3600_000).toISOString().slice(0, 13)).toBe("2026-03-20T17");
    const [c] = assignGauges([crossing()], s);
    expect(c.gaugeId).toBe("rg1");
  });

  it("reads a plain time,rain CSV and a TAHMO-style export with quality flags", () => {
    const plain = "time,rain_mm\n2026-03-20 17:00,0\n2026-03-20 17:15,4.2\n2026-03-20 17:30,6.1\n2026-03-20 17:45,0.4\n";
    const a = parseStationCsv(plain, "plain.csv").series;
    expect(a.n).toBe(4);
    expect(a.rain.gauge.reduce<number>((x, v) => x + (v ?? 0), 0)).toBeCloseTo(10.7, 5);
    const tahmo =
      "time,station_id,precip_sensor_id,precip_mm,precip_quality_flag\n" +
      ["00", "05", "10", "15", "20", "25"].map((m, k) => `2026-03-20T14:${m}:00Z,TA00024,1,${k === 2 ? 9 : 1},${k === 2 ? -1 : 1}`).join("\n");
    const b = parseStationCsv(tahmo, "tahmo.csv").series;
    expect(b.gauges[0].id).toBe("TA00024");
    const total = b.rain.TA00024.reduce<number>((x, v) => x + (v ?? 0), 0);
    expect(total).toBeCloseTo(5, 5); // the flagged 9 mm reading is dropped
  });
});
