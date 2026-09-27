"use client";

import { useEffect, useState } from "react";

// Everyone sees the same clock: it counts up from this moment and starts
// over at 00:00:00 every 100 hours, so it's always HH:MM:SS.
const CYCLE_START_MS = Date.UTC(2026, 8, 27); // 27 Sep 2026, 00:00 UTC
const CYCLE_SECONDS = 100 * 60 * 60;

// How often the clock is re-read. The display only changes once a second (a
// repeat of the same second doesn't re-render), so checking a few times a
// second just keeps each tick close to the real second boundary.
const CHECK_INTERVAL_MS = 250;

function secondsIntoCycle(now: number): number {
  const elapsed = Math.floor((now - CYCLE_START_MS) / 1000);
  // The double modulo keeps a device clock set before the start in range too.
  return ((elapsed % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

type HeroTimerProps = {
  /** Server render time — the first paint's "now", so it matches on hydration. */
  renderedAt: number;
};

/**
 * The hero's huge, blurred clock in the background — one shared count for
 * every visitor, carrying on across page loads, resetting every 100 hours.
 * Decorative, so it's hidden from screen readers.
 */
export default function HeroTimer({ renderedAt }: HeroTimerProps) {
  const [cycleSeconds, setCycleSeconds] = useState(() => secondsIntoCycle(renderedAt));

  useEffect(() => {
    const tick = () => setCycleSeconds(secondsIntoCycle(Date.now()));
    tick();
    const id = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 208px at the 1280×770 design size, shrinking with narrower or shorter
  // screens. The blur is in em (15px at 208px, Figma's layer blur of 30) so
  // it stays in proportion at every size.
  return (
    <p
      aria-hidden
      className="select-none whitespace-nowrap font-inter text-[clamp(48px,min(16.25vw,27.02vh),208px)] font-semibold leading-[normal] text-white tabular-nums opacity-60 blur-[0.0721em]"
    >
      {formatClock(cycleSeconds)}
    </p>
  );
}
