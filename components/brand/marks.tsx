import type { SVGProps } from "react";

type MarkProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

/** A: the depth post standing in water. Chosen mark; it's also the map marker. */
export function MarkPost({ size = 28, title = "Crossing Watch", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={title} {...rest}>
      <title>{title}</title>
      <path fill="var(--ink)" fillRule="evenodd" d="M17 3h14v34H17zM17 11h14v6H17zM17 23h14v6H17z" />
      <path fill="var(--rain)" d="M3 34.5c3.5-2.4 7-2.4 10.5 0s7 2.4 10.5 0 7-2.4 10.5 0 7 2.4 10.5 0V45H3z" />
    </svg>
  );
}

/** B: a road dipping through a stream bed (a "drift"). */
export function MarkDrift({ size = 28, title = "Crossing Watch", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={title} {...rest}>
      <title>{title}</title>
      <path fill="none" stroke="var(--ink)" strokeWidth={7} strokeLinejoin="round" d="M2 15h13l9 16 9-16h13" />
      <path fill="var(--rain)" d="M13.5 30h21L24 44z" />
    </svg>
  );
}

/** C: a C cut by a water line. */
export function MarkC({ size = 28, title = "Crossing Watch", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={title} {...rest}>
      <title>{title}</title>
      <path fill="none" stroke="var(--ink)" strokeWidth={8} d="M37 12.5A16 16 0 1 0 37 35.5" />
      <path fill="var(--rain)" d="M4 30c4-2.6 8-2.6 12 0s8 2.6 12 0 8-2.6 12 0 4 0 6 0v5c-2 0-4 0-6 0s-8 2.6-12 0-8-2.6-12 0-8 2.6-12 0z" />
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="font-display font-bold leading-none tracking-[-0.01em] text-ink" style={{ fontSize: size }}>
      Crossing Watch
    </span>
  );
}

export function Lockup({ mark = 28, word = 22 }: { mark?: number; word?: number }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <MarkPost size={mark} title="" aria-hidden />
      <Wordmark size={word} />
    </span>
  );
}
