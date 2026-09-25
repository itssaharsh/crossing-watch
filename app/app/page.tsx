import type { Metadata } from "next";
import { RiderStandalone } from "@/components/rider/RiderStandalone";
import { StoreProvider } from "@/lib/state/store";

export const metadata: Metadata = { title: "Rider app" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function RiderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <StoreProvider
      options={{
        follow: str(sp.follow) === "1",
        startAt: str(sp.t) ?? "first-red",
        selected: "kimbo-matangi",
        dataset: str(sp.data) === "simulated" ? "simulated" : undefined,
      }}
    >
      <RiderStandalone openId={str(sp.c)} state={str(sp.state)} />
    </StoreProvider>
  );
}
