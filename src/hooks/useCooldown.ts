"use client";

import { useEffect, useState } from "react";

function computeRemainingMs(sinceIso: string, cooldownMs: number): number {
  const elapsed = Date.now() - new Date(sinceIso).getTime();
  return Math.max(0, cooldownMs - elapsed);
}

function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Tracks a per-identity cooldown (e.g. "I'm Still Here", once per hour). */
export function useCooldown(sinceIso: string | null, cooldownMs: number) {
  const [remainingMs, setRemainingMs] = useState(() =>
    sinceIso ? computeRemainingMs(sinceIso, cooldownMs) : 0,
  );

  useEffect(() => {
    if (!sinceIso) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(computeRemainingMs(sinceIso, cooldownMs));
    const id = setInterval(() => {
      setRemainingMs(computeRemainingMs(sinceIso, cooldownMs));
    }, 15_000);
    return () => clearInterval(id);
  }, [sinceIso, cooldownMs]);

  return {
    active: remainingMs > 0,
    remainingLabel: remainingMs > 0 ? formatRemaining(remainingMs) : null,
  };
}
