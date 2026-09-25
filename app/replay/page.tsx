import type { Metadata } from "next";
import { Stage } from "@/components/stage/Stage";
import { StoreProvider } from "@/lib/state/store";

export const metadata: Metadata = {
  title: "Replay",
  description: "The 20 March 2026 storm replayed from the JKUAT gauge: a call for each Juja crossing, and the rider's phone beside it.",
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ReplayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <StoreProvider
      options={{
        autoplay: str(sp.autoplay) !== "0",
        startAt: str(sp.t),
        selected: str(sp.c),
        publish: true,
        dataset: str(sp.data) === "simulated" ? "simulated" : undefined,
      }}
    >
      <Stage pinnedId="kimbo-matangi" />
    </StoreProvider>
  );
}
