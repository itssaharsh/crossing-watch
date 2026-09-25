export const dynamic = "force-dynamic";

interface SharedClock {
  i: number;
  playing: boolean;
  speed: number;
  i0: number;
  i1: number;
  kind: string;
  n: number;
  at: number;
}

const g = globalThis as unknown as { __cwClock?: SharedClock | null };

/** The stage publishes its replay position so phones in the room can follow it. */
export async function GET() {
  return Response.json({ clock: g.__cwClock ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const b = (await request.json()) as Partial<SharedClock>;
    const ok = [b.i, b.i0, b.i1, b.n, b.speed].every((x) => typeof x === "number" && Number.isFinite(x));
    if (!ok) return Response.json({ error: "Expected numeric i, i0, i1, n, speed." }, { status: 400 });
    g.__cwClock = {
      i: b.i!,
      playing: !!b.playing,
      speed: b.speed!,
      i0: b.i0!,
      i1: b.i1!,
      kind: String(b.kind ?? "demo").slice(0, 16),
      n: b.n!,
      at: Date.now(),
    };
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
}
