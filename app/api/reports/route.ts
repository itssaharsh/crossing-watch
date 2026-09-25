import { addReport, clearReports, listReports, removeReport, validateReport } from "@/lib/server/reports-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ reports: await listReports() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const r = validateReport(body);
  if (!r) return Response.json({ error: "Expected {id, crossingId, t, status: flooded|clear}." }, { status: 400 });
  return Response.json({ report: await addReport(r) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) await removeReport(id);
  else await clearReports();
  return new Response(null, { status: 204 });
}
