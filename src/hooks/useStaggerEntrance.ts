"use client";

import { useEffect, useState } from "react";

const ENTRANCE_BASE = "transition-[opacity,transform] duration-300 ease-out";
const ENTRANCE_HIDDEN = "opacity-0 translate-y-1.5";
const ENTRANCE_SHOWN = "opacity-100 translate-y-0";

/**
 * Transition-based (not a `fill: both` @keyframes animation) staggered
 * entrance, matching the dropdown menu's animation style. A transition
 * releases the property back to ordinary CSS once it settles; a filled
 * keyframe animation instead keeps outranking later rules (like :hover)
 * indefinitely, which is a real bug we hit building the nav hover state.
 */
export function useStaggerEntrance(baseDelayMs = 70, stepMs = 35) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let index = 0;

  return function entrance() {
    const delay = `${baseDelayMs + index * stepMs}ms`;
    index += 1;
    return {
      className: `${ENTRANCE_BASE} ${mounted ? ENTRANCE_SHOWN : ENTRANCE_HIDDEN}`,
      style: { transitionDelay: delay },
    };
  };
}
