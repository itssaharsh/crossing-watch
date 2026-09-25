import type { Metadata, Viewport } from "next";
import { body, display, mono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Crossing Watch · Juja",
    template: "%s · Crossing Watch",
  },
  description:
    "Cross, wait or reroute: a call for each named river crossing in Juja, learned from a 15-minute rain gauge and riders' reports.",
  applicationName: "Crossing Watch",
};

export const viewport: Viewport = {
  themeColor: "#E3E7E7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
