"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const DEVICE_W = 414;
const DEVICE_H = 868;

/** A device frame that scales a real 390×844 app screen to fit its column. */
export function PhoneFrame({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = box.w && box.h ? Math.min(box.w / DEVICE_W, box.h / DEVICE_H, 1) : 0;
  return (
    <div className="flex h-full min-h-0 flex-col items-center">
      {caption && <p className="mb-2 w-full text-center text-[13px] text-ink-muted">{caption}</p>}
      <div ref={ref} className="relative min-h-0 w-full flex-1">
        {s > 0 && (
          <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{ width: DEVICE_W * s, height: DEVICE_H * s }}>
            <div
              className="rounded-[44px] bg-ink p-3 shadow-device"
              style={{ width: DEVICE_W, height: DEVICE_H, transform: `scale(${s})`, transformOrigin: "top left" }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-canvas">{children}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
