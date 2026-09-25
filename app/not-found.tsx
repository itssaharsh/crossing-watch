import Link from "next/link";
import { MarkPost } from "@/components/brand/marks";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <MarkPost size={56} title="" aria-hidden />
      <h1 className="font-display text-[56px] font-extrabold uppercase leading-none">No crossing here</h1>
      <p className="max-w-[40ch] text-[16px] text-ink-muted">This page doesn&rsquo;t exist. The crossings you&rsquo;re after are on the replay.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-[15px] font-bold text-accent-ink hover:bg-accent-hover">
        Back to the replay
      </Link>
    </main>
  );
}
