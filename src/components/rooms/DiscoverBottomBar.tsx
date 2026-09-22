"use client";

import type { FormEvent } from "react";

type ViewMode = "discover" | "mine";

type DiscoverBottomBarProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
};

export default function DiscoverBottomBar({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
}: DiscoverBottomBarProps) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[206px]"
        style={{ backgroundImage: "linear-gradient(to top, #0c0d10, rgba(12,13,16,0))" }}
      />

      {/* pointer-events-none on this whole fixed bar: on short viewports its
          empty space can overlap earlier-in-page content (e.g. the trending
          carousel's Join Room button), and without this that dead space
          would silently swallow clicks meant for whatever's underneath.
          Each actual control opts back in with pointer-events-auto. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-20 flex flex-col items-center gap-5 px-5">
        <div className="flex w-full max-w-[494px] flex-col items-center gap-5">
          <div className="flex items-center gap-[7px]">
            <button
              type="button"
              onClick={() => onViewModeChange("discover")}
              className="pointer-events-auto rounded-[30px] px-3.5 py-2.5 font-satoshi text-[14px] transition-colors"
              style={
                viewMode === "discover"
                  ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)", color: "#000" }
                  : { backgroundColor: "#1d1d1d", color: "#d0d0d0" }
              }
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("mine")}
              className="pointer-events-auto rounded-[30px] px-3.5 py-2.5 font-satoshi text-[14px] transition-colors"
              style={
                viewMode === "mine"
                  ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)", color: "#000" }
                  : { backgroundColor: "#1d1d1d", color: "#d0d0d0" }
              }
            >
              Rooms i Created
            </button>
          </div>

          <form onSubmit={onSearchSubmit} className="flex w-full items-center gap-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search For Rooms..."
              className="pointer-events-auto h-12 flex-1 rounded-[10px] border border-[rgba(227,221,221,0.4)] bg-[#202021] px-3.5 font-figtree text-[14px] text-white placeholder:text-white/60 focus:outline-none"
            />
            <button
              type="submit"
              className="pointer-events-auto relative flex h-12 w-[100px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)]"
            >
              <span className="relative flex size-full items-center justify-center gap-1 overflow-hidden rounded-[9px]">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-[9px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(181.39deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                  }}
                />
                <span className="relative font-figtree text-[14px] font-medium text-black">
                  Search
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="relative size-4" src="/icons/search-solid.svg" />
              </span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
