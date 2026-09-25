"use client";

import { useEffect, useState } from "react";

/**
 * prefers-reduced-motion, read after mount so the server render and the first
 * client render always agree (Motion's own hook differs between the two).
 */
export function useReduced(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setReduce(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return reduce;
}
