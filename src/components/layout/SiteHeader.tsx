"use client";

import { useEffect, useRef, useState } from "react";
import NavBar from "@/components/home/NavBar";

type SiteHeaderProps = {
  anonId: string | null;
};

/**
 * Nav bar + its dropdown menu, with the open/close state, outside-click, and
 * Escape handling that used to live only in HomeScreen — extracted so any
 * page can reuse the exact same header/menu behavior.
 */
export default function SiteHeader({ anonId }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <>
      {isMenuOpen ? (
        <div
          aria-hidden
          className="fixed inset-0 z-[35] bg-black/40 backdrop-blur-[2px] transition-opacity"
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}

      <div ref={containerRef} className="contents">
        <NavBar
          isMenuOpen={isMenuOpen}
          onToggleMenu={() => setIsMenuOpen((open) => !open)}
          onNavigate={() => setIsMenuOpen(false)}
          anonId={anonId}
        />
      </div>
    </>
  );
}
