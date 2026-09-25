import type { Metadata } from "next";
import { How } from "@/components/how/How";
import { StoreProvider } from "@/lib/state/store";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Crossing Watch learns a flood trigger for each Juja crossing from a 15-minute rain gauge and riders' reports.",
};

export default function HowPage() {
  return (
    <StoreProvider>
      <How />
    </StoreProvider>
  );
}
