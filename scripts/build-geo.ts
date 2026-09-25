/**
 * Builds data/geo/juja.json (map geometry) and fills in computed detours in
 * data/crossings.json, from OpenStreetMap via Overpass.
 *
 *   npx tsx scripts/build-geo.ts            # uses .cache/overpass.json if present
 *   npx tsx scripts/build-geo.ts --refresh  # re-downloads
 *
 * Map data © OpenStreetMap contributors (ODbL).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CACHE = join(ROOT, ".cache/overpass.json");
const OUT = join(ROOT, "data/geo/juja.json");
const CROSSINGS = join(ROOT, "data/crossings.json");

/** Map frame (lon/lat). Covers Kimbo junction to the Ndarugu bridge, JKUAT to the Ruiru River. */
const FRAME = { west: 36.956, east: 37.162, south: -1.186, north: -1.079 };
const QUERY_BBOX = "-1.215,36.915,-1.02,37.16";
const WIDTH = 1000;

interface Pt {
  lat: number;
  lon: number;
}
interface Way {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: Pt[];
  nodes?: number[];
}
interface Node {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

async function fetchOverpass() {
  const q = `[out:json][timeout:180];
(
  way["waterway"~"^(river|stream|canal|drain)$"](${QUERY_BBOX});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|track|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${QUERY_BBOX});
  node["place"~"^(town|suburb|village|neighbourhood|hamlet|locality|quarter)$"](${QUERY_BBOX});
  nwr["amenity"="university"](${QUERY_BBOX});
);
out body geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "CrossingWatch-hackathon/0.1" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  mkdirSync(join(ROOT, ".cache"), { recursive: true });
  writeFileSync(CACHE, await res.text());
}

// ---------- projection ----------
const latMid = ((FRAME.north + FRAME.south) / 2) * (Math.PI / 180);
const kx = Math.cos(latMid);
const SCALE = WIDTH / ((FRAME.east - FRAME.west) * kx);
const HEIGHT = Math.round((FRAME.north - FRAME.south) * SCALE);
const px = (p: Pt): [number, number] => [(p.lon - FRAME.west) * kx * SCALE, (FRAME.north - p.lat) * SCALE];

const R = 6371000;
const rad = Math.PI / 180;
function dist(a: Pt, b: Pt) {
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * R;
}

// Douglas–Peucker in projected units
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function clipToFrame(g: Pt[], pad = 0.028): Pt[][] {
  // split a polyline into runs inside the (padded) frame
  const inside = (p: Pt) => p.lon >= FRAME.west - pad && p.lon <= FRAME.east + pad && p.lat >= FRAME.south - pad && p.lat <= FRAME.north + pad;
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of g) {
    if (inside(p)) cur.push(p);
    else if (cur.length) {
      cur.push(p);
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

const d3 = (n: number) => Math.round(n * 10) / 10;
function toPath(g: Pt[], tol = 0.6): string {
  const out: string[] = [];
  for (const run of clipToFrame(g)) {
    const s = simplify(run.map(px), tol);
    if (s.length < 2) continue;
    out.push("M" + s.map(([x, y]) => `${d3(x)} ${d3(y)}`).join("L"));
  }
  return out.join("");
}

// ---------- routing ----------
interface Graph {
  coord: Map<number, Pt>;
  adj: Map<number, { to: number; w: number; way: Way }[]>;
}

function buildGraph(ways: Way[]): Graph {
  const coord = new Map<number, Pt>();
  const adj: Graph["adj"] = new Map();
  for (const w of ways) {
    if (!w.nodes || !w.geometry || w.nodes.length !== w.geometry.length) continue;
    if (w.tags?.access === "private" || w.tags?.access === "no") continue;
    for (let i = 0; i < w.nodes.length; i++) coord.set(w.nodes[i], w.geometry[i]);
    for (let i = 0; i < w.nodes.length - 1; i++) {
      const a = w.nodes[i];
      const b = w.nodes[i + 1];
      const d = dist(w.geometry[i], w.geometry[i + 1]);
      // prefer made roads a little: boda riders avoid tracks when they can
      const cls = w.tags?.highway ?? "";
      const f = /track|service/.test(cls) ? 1.35 : /residential|unclassified|living/.test(cls) ? 1.1 : 1;
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push({ to: b, w: d * f, way: w });
      adj.get(b)!.push({ to: a, w: d * f, way: w });
    }
  }
  return { coord, adj };
}

function nearestNode(g: Graph, p: Pt, avoid?: { p: Pt; r: number }): number {
  let best = -1;
  let bd = Infinity;
  for (const [id, c] of g.coord) {
    if (!g.adj.get(id)?.length) continue;
    if (avoid && dist(c, avoid.p) < avoid.r) continue;
    const d = dist(c, p);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

function dijkstra(g: Graph, from: number, to: number, avoid?: { p: Pt; r: number }) {
  const distM = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, { n: number; way: Way }>();
  const done = new Set<number>();
  // small binary heap
  const heap: [number, number][] = [[0, from]];
  const push = (x: [number, number]) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const e of g.adj.get(u) ?? []) {
      if (avoid && dist(g.coord.get(e.to)!, avoid.p) < avoid.r) continue;
      const nd = d + e.w;
      if (nd < (distM.get(e.to) ?? Infinity)) {
        distM.set(e.to, nd);
        prev.set(e.to, { n: u, way: e.way });
        push([nd, e.to]);
      }
    }
  }
  if (!prev.has(to) && from !== to) return null;
  const nodes: number[] = [to];
  const ways: Way[] = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    ways.push(p.way);
    cur = p.n;
    nodes.push(cur);
  }
  nodes.reverse();
  ways.reverse();
  let meters = 0;
  for (let i = 0; i < nodes.length - 1; i++) meters += dist(g.coord.get(nodes[i])!, g.coord.get(nodes[i + 1])!);
  return { nodes, ways, meters };
}

/** Two road points about `m` metres (by road) from p, on opposite sides of it: a trip that passes through p. */
function tripThrough(g: Graph, p: Pt, m: number): [Pt, Pt] | null {
  const s = nearestNode(g, p);
  if (s < 0) return null;
  const dm = new Map<number, number>([[s, 0]]);
  const q: [number, number][] = [[0, s]];
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [d, u] = q.shift()!;
    if (d > (dm.get(u) ?? Infinity) || d > m * 1.4) continue;
    for (const e of g.adj.get(u) ?? []) {
      const nd = d + dist(g.coord.get(u)!, g.coord.get(e.to)!);
      if (nd < (dm.get(e.to) ?? Infinity)) {
        dm.set(e.to, nd);
        q.push([nd, e.to]);
      }
    }
  }
  const cands = [...dm.entries()].filter(([, d]) => d >= m * 0.8 && d <= m * 1.4).map(([n]) => g.coord.get(n)!);
  let best: [Pt, Pt] | null = null;
  let bestScore = -1;
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i];
      const b = cands[j];
      const ax = a.lon - p.lon, ay = a.lat - p.lat, bx = b.lon - p.lon, by = b.lat - p.lat;
      const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
      if (cos > -0.5) continue; // need ≥120° apart around the crossing
      const score = dist(a, b);
      if (score > bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
  }
  return best;
}

function namedRoads(ways: Way[], exclude: string[]) {
  const len = new Map<string, number>();
  for (const w of ways) {
    const n = w.tags?.name ?? (w.tags?.ref ? w.tags.ref : "");
    if (!n || exclude.includes(n)) continue;
    len.set(n, (len.get(n) ?? 0) + 1);
  }
  return [...len.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

// ---------- main ----------
interface CrossingCfg {
  id: string;
  lat: number;
  lon: number;
  detours: { via: string; crossingId?: string; extraMin: number; path?: [number, number][]; computed?: boolean; from?: Pt; to?: Pt; avoidM?: number; km?: number }[];
  [k: string]: unknown;
}

async function main() {
  if (process.argv.includes("--refresh") || !existsSync(CACHE)) {
    console.log("fetching Overpass…");
    await fetchOverpass();
  }
  const E = (JSON.parse(readFileSync(CACHE, "utf8")) as { elements: (Way | Node)[] }).elements;
  const ways = E.filter((e): e is Way => e.type === "way" && !!e.geometry);

  const rivers = ways.filter((w) => w.tags?.waterway && /river|stream/.test(w.tags.waterway));
  const roads = ways.filter((w) => w.tags?.highway);

  const riverOut: { name: string; kind: string; d: string }[] = [];
  for (const w of rivers) {
    const d = toPath(w.geometry!, 0.8);
    if (d) riverOut.push({ name: w.tags!.name ?? "", kind: w.tags!.waterway!, d });
  }
  const major = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/;
  const roadOut: { name: string; cls: string; unpaved: boolean; d: string }[] = [];
  for (const w of roads) {
    const cls = w.tags!.highway!;
    const named = !!w.tags!.name;
    const keep = major.test(cls) || (cls === "unclassified" && named) || (cls === "residential" && named && !/Penta/.test(w.tags!.name!));
    if (!keep) continue;
    const d = toPath(w.geometry!, 0.7);
    if (!d) continue;
    const surface = w.tags!.surface ?? "";
    roadOut.push({ name: w.tags!.name ?? w.tags!.ref ?? "", cls: cls.replace("_link", ""), unpaved: /unpaved|ground|dirt|gravel|earth|mud/.test(surface), d });
  }
  // minor streets as one faint texture path (the real street grid, no names)
  const minor = roads
    .filter((w) => /residential|unclassified|living_street/.test(w.tags!.highway!) && !w.tags!.name)
    .map((w) => toPath(w.geometry!, 1.2))
    .filter(Boolean)
    .join("");

  const cfg = JSON.parse(readFileSync(CROSSINGS, "utf8")) as { crossings: CrossingCfg[] };

  // routing graph over every road type
  const graph = buildGraph(roads);
  for (const c of cfg.crossings) {
    for (const det of c.detours) {
      if (det.computed && (det as { auto?: boolean }).auto) {
        const ends = tripThrough(graph, { lat: c.lat, lon: c.lon }, (det.avoidM ?? 300) + 350);
        if (ends) [det.from, det.to] = ends;
      }
      if (!det.computed || !det.from || !det.to) continue;
      const avoid = { p: { lat: c.lat, lon: c.lon }, r: det.avoidM ?? 300 };
      const a = nearestNode(graph, det.from, avoid);
      const b = nearestNode(graph, det.to, avoid);
      const direct = dijkstra(graph, a, b);
      const around = dijkstra(graph, a, b, avoid);
      if (!direct || !around) {
        console.warn(`no detour for ${c.id} via ${det.via}`);
        continue;
      }
      const extraM = Math.max(0, around.meters - direct.meters);
      // boda on mixed Juja roads ≈ 25 km/h
      det.extraMin = Math.max(2, Math.round((extraM / 1000 / 25) * 60));
      det.km = Math.round((around.meters / 1000) * 10) / 10;
      const raw = around.nodes.map((n) => graph.coord.get(n)!);
      const simp = simplify(raw.map((p) => [p.lon * 1e5, p.lat * 1e5] as [number, number]), 1.5);
      det.path = simp.map(([x, y]) => [Math.round(x) / 1e5, Math.round(y) / 1e5] as [number, number]);
      const own = String(c.road ?? "");
      const names = namedRoads(around.ways, [own, own.replace(/ \(.*\)$/, "")]).filter((n) => !/^Matangi Road$/.test(n) || c.id !== "kimbo-matangi");
      const passes = cfg.crossings.find((o) => o.id !== c.id && raw.some((p) => dist(p, { lat: o.lat, lon: o.lon }) < 80));
      if (passes) det.crossingId = passes.id;
      else delete det.crossingId;
      if (!(det as { keepLabel?: boolean }).keepLabel && names[0]) det.via = names[0];
      console.log(`${c.id}: detour ${det.via} = ${det.km} km (+${Math.round(extraM)} m, +${det.extraMin} min); roads: ${names.slice(0, 5).join(", ")}`);
    }
  }
  // keep coordinate pairs on one line so the file stays readable
  const pretty = JSON.stringify(cfg, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, "[$1, $2]");
  writeFileSync(CROSSINGS, pretty + "\n");

  // Curated labels (OSM place nodes are sparse here); sources in the research notes.
  const PLACES: { name: string; kind: string; lat: number; lon: number }[] = [
    { name: "Juja", kind: "town", lat: -1.1015, lon: 37.016 },
    { name: "JKUAT", kind: "campus", lat: -1.0968, lon: 37.0105 },
    { name: "Kimbo", kind: "junction", lat: -1.1326, lon: 36.9757 },
    { name: "Matangi", kind: "area", lat: -1.1666, lon: 37.0088 },
    { name: "Theta", kind: "area", lat: -1.1289, lon: 36.9963 },
    { name: "Ruiru", kind: "town", lat: -1.1473, lon: 36.9604 },
    { name: "Gachororo", kind: "area", lat: -1.0893, lon: 37.02 },
    { name: "Ndarugu", kind: "village", lat: -1.1078, lon: 37.0502 },
    { name: "Juja Farm", kind: "area", lat: -1.1662, lon: 37.0896 },
    { name: "Komo", kind: "village", lat: -1.1216, lon: 37.1518 },
  ];
  const places = PLACES.map((p) => ({ name: p.name, kind: p.kind, x: d3(px(p)[0]), y: d3(px(p)[1]) }));
  const project = { west: FRAME.west, north: FRAME.north, kx, scale: SCALE };

  mkdirSync(join(ROOT, "data/geo"), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      attribution: "© OpenStreetMap contributors",
      frame: FRAME,
      project,
      width: WIDTH,
      height: HEIGHT,
      rivers: riverOut,
      roads: roadOut,
      minor,
      places,
    }),
  );
  console.log(`wrote ${OUT}: ${WIDTH}×${HEIGHT}, ${riverOut.length} rivers, ${roadOut.length} roads, ${places.length} places`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
