import type { SVGProps } from "react";

// Custom glyphs for the product's own objects. 24 grid, 2px round stroke: matches Tabler.
type G = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: G & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** g-post: the depth post beside a drift */
export const GPost = (p: G) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="15" rx="1" />
    <path d="M9 8h6M9 13h6" />
    <path d="M3 20c2-1.3 4-1.3 6 0s4 1.3 6 0 4-1.3 6 0" />
  </Base>
);

/** g-post-high: water up the post (reporting "flooded") */
export const GPostHigh = (p: G) => (
  <Base {...p}>
    <path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
    <path d="M9 7h6" />
    <path d="M3 12c2-1.3 4-1.3 6 0s4 1.3 6 0 4-1.3 6 0" />
    <path d="M3 17c2-1.3 4-1.3 6 0s4 1.3 6 0 4-1.3 6 0" />
  </Base>
);

/** g-post-low: water well below the road (reporting "clear") */
export const GPostLow = (p: G) => (
  <Base {...p}>
    <path d="M3 11h18" />
    <rect x="9" y="3" width="6" height="16" rx="1" />
    <path d="M9 7h6" />
    <path d="M3 21c2-1.3 4-1.3 6 0s4 1.3 6 0 4-1.3 6 0" />
  </Base>
);

/** g-gauge: tipping-bucket rain gauge (funnel over a canister) */
export const GGauge = (p: G) => (
  <Base {...p}>
    <path d="M5 4h14l-4 5H9z" />
    <path d="M12 9v2" />
    <rect x="7" y="11" width="10" height="10" rx="1" />
    <path d="M7 16h10" />
  </Base>
);

/** g-drift: a road dipping through water */
export const GDrift = (p: G) => (
  <Base {...p}>
    <path d="M2 7h5l5 7 5-7h5" />
    <path d="M7 18c1.7-1.1 3.3-1.1 5 0s3.3 1.1 5 0" />
  </Base>
);
