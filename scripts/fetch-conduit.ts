/**
 * Pulls JKUAT station rows from the Conduit API into a CSV that
 * scripts/ingest.ts (and the app's CSV drop) can read.
 *
 *   CONDUIT_EMAIL=you@example.com CONDUIT_API_KEY=… npm run data:fetch -- 2026-04-18 2026-04-30 out.csv
 *
 * Keys come from https://conduit.jhubafrica.com (one per user). Never commit them:
 * put them in .env.local, which git and Vercel ignore.
 */
import { writeFileSync } from "node:fs";

const [from, to, out] = process.argv.slice(2);
const email = process.env.CONDUIT_EMAIL;
const apikey = process.env.CONDUIT_API_KEY;
if (!from || !to || !out || !email || !apikey) {
  console.error("usage: CONDUIT_EMAIL=… CONDUIT_API_KEY=… npm run data:fetch -- <from YYYY-MM-DD> <to YYYY-MM-DD> <out.csv>");
  process.exit(1);
}

async function main(from: string, to: string, out: string, email: string, apikey: string) {
  const res = await fetch("https://conduit.jhubafrica.com/data.php", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ apikey, email, fromdate: from, todate: to }),
  });
  const body = (await res.json().catch(() => null)) as { status?: string; headers?: string[]; data?: Record<string, string>[]; message?: string } | null;
  if (!res.ok || body?.status !== "success" || !body.headers || !body.data) {
    console.error(`Conduit API: HTTP ${res.status}${body?.message ? `, ${body.message}` : ""}`);
    process.exit(1);
  }
  const cols = body.headers;
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [cols.join(","), ...body.data.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))];
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`wrote ${out}: ${body.data.length} rows, ${body.data[0]?.ts ?? "-"} → ${body.data.at(-1)?.ts ?? "-"}`);
}

main(from, to, out, email, apikey).catch((e) => {
  console.error(e);
  process.exit(1);
});
