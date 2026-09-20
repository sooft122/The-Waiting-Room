"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "waiting-room:recent-searches";
const MAX_ENTRIES = 8;

/**
 * Per-device search history, kept in localStorage — there's no product
 * requirement for this to sync across devices, so it stays client-only
 * rather than adding a backend round-trip for a personal convenience list.
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch {
      // Corrupt or inaccessible storage — start from an empty history.
    } finally {
      setHydrated(true);
    }
  }, []);

  const persist = useCallback((next: string[]) => {
    setRecentSearches(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private browsing, quota) — state still updates in memory.
    }
  }, []);

  const addSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setRecentSearches((current) => {
        const deduped = current.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
        const next = [trimmed, ...deduped].slice(0, MAX_ENTRIES);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeSearch = useCallback(
    (query: string) => {
      setRecentSearches((current) => {
        const next = current.filter((entry) => entry !== query);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearSearches = useCallback(() => persist([]), [persist]);

  return { recentSearches, hydrated, addSearch, removeSearch, clearSearches };
}
