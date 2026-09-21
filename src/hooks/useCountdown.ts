"use client";

import { useEffect, useState } from "react";

export type Countdown = { days: number; hrs: number; mins: number; secs: number; totalMs: number };

const ONE_HOUR_MS = 60 * 60 * 1000;

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
 * while more than an hour remains, then switches to ticking every second so
 * the last hour counts down smoothly instead of jumping by whole minutes. */
export function useCountdown(targetIso: string): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(() => computeCountdown(targetIso));

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const next = computeCountdown(targetIso);
      setCountdown(next);
      if (!next) return;
      const delay = next.totalMs <= ONE_HOUR_MS ? 1000 : 60_000;
      timeoutId = setTimeout(tick, delay);
    }

    const initial = computeCountdown(targetIso);
    const initialDelay = initial && initial.totalMs <= ONE_HOUR_MS ? 1000 : 60_000;
    timeoutId = setTimeout(tick, initialDelay);

    return () => clearTimeout(timeoutId);
  }, [targetIso]);

  return countdown;
}
