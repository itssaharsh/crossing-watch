import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Crossing Watch: Kimbo–Matangi Road, REROUTE, likely flooded for about 2 hours, use Theta Road";

const font = (f: string) => readFile(join(process.cwd(), "node_modules/@fontsource", f));

export default async function Image() {
  const [display, bold, body] = await Promise.all([
    font("barlow-condensed/files/barlow-condensed-latin-800-normal.woff"),
    font("atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff"),
    font("atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff"),
  ]);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#E3E7E7", padding: 64, gap: 56, fontFamily: "Atkinson" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 470 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="56" height="56" viewBox="0 0 48 48">
              <path fill="#0E1A20" fillRule="evenodd" d="M17 3h14v34H17zM17 11h14v6H17zM17 23h14v6H17z" />
              <path fill="#2C7FB8" d="M3 34.5c3.5-2.4 7-2.4 10.5 0s7 2.4 10.5 0 7-2.4 10.5 0 7 2.4 10.5 0V45H3z" />
            </svg>
            <span style={{ fontFamily: "Barlow", fontSize: 52, color: "#0E1A20" }}>Crossing Watch</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontFamily: "Barlow", fontSize: 76, lineHeight: 0.95, color: "#0E1A20" }}>Know which crossing is flooded before you ride into it.</span>
            <span style={{ fontSize: 26, color: "#4B5A5F" }}>Juja, Kiambu · a call for each named crossing, every 15 minutes</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#C42B1C", borderRadius: 18, padding: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, border: "6px solid rgba(255,255,255,.92)", borderRadius: 10, padding: "26px 30px", color: "#fff" }}>
            <span style={{ fontFamily: "Barlow", fontSize: 50 }}>Kimbo–Matangi Road</span>
            <span style={{ fontFamily: "Barlow", fontSize: 128, lineHeight: 0.9, marginTop: 8 }}>REROUTE</span>
            <span style={{ fontSize: 34, marginTop: 14, fontWeight: 700 }}>Likely flooded for ~2 h</span>
            <div style={{ display: "flex", marginTop: 22, background: "#fff", color: "#B02617", borderRadius: 8, padding: "14px 20px", fontSize: 32, fontWeight: 700 }}>→ Use Theta Road</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Barlow", data: display, weight: 800, style: "normal" },
        { name: "Atkinson", data: bold, weight: 700, style: "normal" },
        { name: "Atkinson", data: body, weight: 400, style: "normal" },
      ],
    },
  );
}
