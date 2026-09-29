"use client";

import { useCallback, useRef } from "react";

/**
 * Wraps a dashboard read so that, on a slow connection, timed refreshes
 * never pile up behind one that's still running, and an older response can
 * never overwrite a newer one (say, a refresh that started just before a
 * change finishing just after it). Call `run()` to refresh now, `run(true)`
 * from a timer. Pass stable (memoized) callbacks.
 */
export function useLatest<T>(
  fetcher: () => Promise<T>,
  onValue: (value: T) => void,
  onError?: (error: unknown) => void,
): (fromTimer?: boolean) => Promise<void> {
  const state = useRef({ started: 0, applied: 0, inFlight: 0 });

  return useCallback(
    async (fromTimer = false) => {
      const current = state.current;
      if (fromTimer && current.inFlight > 0) return;
      const sequence = ++current.started;
      current.inFlight += 1;
      try {
        const value = await fetcher();
        if (sequence > current.applied) {
          current.applied = sequence;
          onValue(value);
        }
      } catch (error) {
        if (sequence > current.applied) onError?.(error);
      } finally {
        current.inFlight -= 1;
      }
    },
    [fetcher, onValue, onError],
  );
}
