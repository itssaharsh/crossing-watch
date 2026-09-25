import { networkInterfaces } from "node:os";

export const dynamic = "force-dynamic";

/** LAN address of this machine, so the stage's QR code works for phones in the room. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const port = url.port || (url.protocol === "https:" ? "" : "80");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local) return Response.json({ origin: url.origin });
  const addrs: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) addrs.push(a.address);
  }
  // Prefer typical home/office Wi-Fi ranges over virtual adapters
  const pick = addrs.find((a) => a.startsWith("192.168.")) ?? addrs.find((a) => a.startsWith("10.")) ?? addrs[0];
  return Response.json({ origin: pick ? `http://${pick}${port ? `:${port}` : ""}` : url.origin, candidates: addrs });
}
