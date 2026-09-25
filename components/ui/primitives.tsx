"use client";

import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Call } from "@/lib/model/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const V: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-press [@media(hover:hover)]:hover:bg-accent-hover",
  secondary: "bg-surface-1 text-ink border border-line hover:border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
};
const S: Record<Size, string> = {
  sm: "h-8 px-3 text-[14px] gap-1.5",
  md: "h-10 px-4 text-[15px] gap-2",
  lg: "h-11 px-4 text-[15px] gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; reason?: string; busy?: boolean }
>(function Button({ variant = "secondary", size = "md", reason, busy, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled}
      aria-busy={busy || undefined}
      title={disabled && reason ? reason : rest.title}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-bold leading-none",
        "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[.97]",
        "disabled:opacity-40 disabled:active:scale-100",
        V[variant],
        S[size],
        className,
      )}
    >
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: number }>(
  function IconButton({ label, size = 36, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        {...rest}
        style={{ width: size, height: size, ...rest.style }}
        className={cx(
          "inline-flex items-center justify-center rounded-md text-ink-muted transition-[background-color,color,transform] duration-150",
          "hover:bg-surface-2 hover:text-ink active:scale-[.94] disabled:opacity-40",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);

export const CALL_FILL: Record<Call, string> = {
  cross: "var(--cross)",
  wait: "var(--wait)",
  reroute: "var(--reroute)",
  nocall: "var(--nocall)",
};
export const CALL_TEXT: Record<Call, string> = {
  cross: "var(--cross-text)",
  wait: "var(--wait-text)",
  reroute: "var(--reroute-text)",
  nocall: "var(--nocall)",
};

export function StatusChip({ call, label, className }: { call: Call; label: string; className?: string }) {
  return (
    <span
      className={cx("label inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm px-2", className)}
      style={{
        color: CALL_TEXT[call],
        background: `color-mix(in oklch, ${CALL_FILL[call]} 13%, var(--surface-1))`,
      }}
    >
      <span
        aria-hidden
        className={cx("size-2 shrink-0", call === "nocall" && "hatch")}
        style={{ background: call === "nocall" ? undefined : CALL_FILL[call], boxShadow: call === "wait" ? "0 0 0 1px var(--wait-text)" : undefined }}
      />
      {label}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface-2 px-1 font-mono text-[11px] leading-none text-ink-muted">
      {children}
    </kbd>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = "sm",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-md border border-line bg-surface-1 p-0.5", size === "sm" ? "h-8" : "h-10")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-w-8 rounded-[4px] px-2 font-mono text-[12px] font-semibold tnum transition-colors duration-150",
              on ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tooltip: first open after 600ms, then instant while moving between triggers. */
let warmUntil = 0;
export function Tip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const id = useId();
  useEffect(() => () => window.clearTimeout(t.current), []);
  const show = () => {
    window.clearTimeout(t.current);
    const delay = Date.now() < warmUntil ? 0 : 600;
    t.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(t.current);
    if (open) warmUntil = Date.now() + 400;
    setOpen(false);
  };
  return (
    <span className="relative inline-flex" onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide} aria-describedby={open ? id : undefined}>
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cx(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-[13px] leading-snug text-canvas shadow-pop",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
