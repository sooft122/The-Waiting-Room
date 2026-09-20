"use client";

import { useEffect, useState } from "react";

function formatElapsed(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Live "time since" label for an ISO timestamp, ticking every 30s. Null in, null out. */
export function useElapsed(sinceIso: string | null): string | null {
  const [label, setLabel] = useState<string | null>(() =>
    sinceIso ? formatElapsed(sinceIso) : null,
  );

  useEffect(() => {
    if (!sinceIso) {
      setLabel(null);
      return;
    }
    setLabel(formatElapsed(sinceIso));
    const id = setInterval(() => setLabel(formatElapsed(sinceIso)), 30_000);
    return () => clearInterval(id);
  }, [sinceIso]);

  return label;
}
