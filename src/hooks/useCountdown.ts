"use client";

import { useEffect, useState } from "react";

export type Countdown = { days: number; hrs: number; mins: number };

function computeCountdown(targetIso: string): Countdown | null {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalMinutes = Math.floor(diff / 60_000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hrs: Math.floor((totalMinutes % (60 * 24)) / 60),
    mins: totalMinutes % 60,
  };
}

/** Live countdown to an ISO date, null once it has passed. Ticks every minute. */
export function useCountdown(targetIso: string): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(() => computeCountdown(targetIso));

  useEffect(() => {
    const id = setInterval(() => setCountdown(computeCountdown(targetIso)), 60_000);
    return () => clearInterval(id);
  }, [targetIso]);

  return countdown;
}
