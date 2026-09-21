"use client";

import { useEffect, useState } from "react";

export type Countdown = { days: number; hrs: number; mins: number; secs: number; totalMs: number };

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function computeCountdown(targetIso: string): Countdown | null {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hrs: Math.floor((totalSeconds % 86_400) / 3600),
    mins: Math.floor((totalSeconds % 3600) / 60),
    secs: totalSeconds % 60,
    totalMs: diff,
  };
}

/** Live countdown to an ISO date, null once it has passed. Ticks every minute
 * while more than a day remains, then switches to ticking every second the
 * moment it drops under a day so the final hours count down smoothly
 * instead of jumping by whole minutes. */
export function useCountdown(targetIso: string): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(() => computeCountdown(targetIso));

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const next = computeCountdown(targetIso);
      setCountdown(next);
      if (!next) return;
      const delay = next.totalMs < ONE_DAY_MS ? 1000 : 60_000;
      timeoutId = setTimeout(tick, delay);
    }

    // Recompute immediately rather than waiting out a delay first — the
    // lazy useState initializer above only ever runs on mount, so without
    // this, switching targetIso (e.g. the trending carousel advancing to a
    // room with a different date) would keep showing the PREVIOUS room's
    // countdown for up to a minute before the first scheduled tick caught up.
    tick();

    return () => clearTimeout(timeoutId);
  }, [targetIso]);

  return countdown;
}
