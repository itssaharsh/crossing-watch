import type { Metadata } from "next";
import { Kit } from "@/components/kit/Kit";
import { StoreProvider } from "@/lib/state/store";

export const metadata: Metadata = { title: "Kit", robots: { index: false } };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function KitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <StoreProvider options={{ startAt: "first-red", selected: "kimbo-matangi" }}>
      <Kit state={str(sp.state)} />
    </StoreProvider>
  );
}
