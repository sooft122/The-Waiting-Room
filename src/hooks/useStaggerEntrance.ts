"use client";

import { useEffect, useState } from "react";

// Same smooth "ease-out-expo" curve as the hero's animate-hero-in — one feel
// for every entrance animation across the app, not a different curve per
// component. Transition-based (not a `fill: both` @keyframes animation),
// matching the dropdown menu's original animation style: a transition
// releases the property back to ordinary CSS once it settles, where a
// filled keyframe animation instead keeps outranking later rules (like
// :hover) indefinitely — a real bug hit building the nav hover state.
const ENTRANCE_BASE = "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]";
const ENTRANCE_HIDDEN = "opacity-0 translate-y-2";
const ENTRANCE_SHOWN = "opacity-100 translate-y-0";

/**
 * Staggered mount-in: each call to the returned `entrance()` gets the next
 * step's delay, in call order. `maxSteps` caps how far the delay keeps
 * growing — past it, every further element shares the last step's delay,
 * so a long list (e.g. a 20-card grid) still finishes settling quickly
 * instead of visibly trickling in one-by-one for seconds.
 */
export function useStaggerEntrance(baseDelayMs = 70, stepMs = 35, maxSteps = Infinity) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let index = 0;

  return function entrance() {
    const step = Math.min(index, maxSteps);
    index += 1;
    return {
      className: `${ENTRANCE_BASE} ${mounted ? ENTRANCE_SHOWN : ENTRANCE_HIDDEN}`,
      style: { transitionDelay: `${baseDelayMs + step * stepMs}ms` },
    };
  };
}
