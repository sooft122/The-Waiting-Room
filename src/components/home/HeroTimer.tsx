"use client";

import { useEffect, useState } from "react";

// How often the clock is re-read. The display only changes once a second (a
// repeat of the same second doesn't re-render), so checking a few times a
// second just keeps each tick close to the real second boundary.
const CHECK_INTERVAL_MS = 250;

/** Always HH:MM:SS. Hours keep counting past 99 rather than wrapping. */
function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * The hero's huge, blurred clock in the background: counts up from 00:00:00
 * for as long as the page is open, with no end. Elapsed time comes from the
 * wall clock rather than counted ticks, so it stays right even after the tab
 * has been in the background (where browsers slow timers down).
 * Decorative, so it's hidden from screen readers.
 */
export default function HeroTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, CHECK_INTERVAL_MS);
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
      {formatElapsed(elapsedSeconds)}
    </p>
  );
}
