import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Barlow_Condensed } from "next/font/google";

// Road-sign lineage for the decision sign and display type
export const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--ff-display",
  display: "swap",
});

// Designed so similar letters can't be confused: text read through a wet screen
export const body = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const mono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});
