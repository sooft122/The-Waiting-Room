"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import RoomCard from "@/components/rooms/RoomCard";
import { useRoomModal } from "@/components/rooms/RoomModalProvider";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import type { Room } from "@/lib/rooms";

type SearchScreenProps = {
  rooms: Room[];
  anonId: string | null;
  initialQuery?: string;
  joinedRoomIds: string[];
};

export default function SearchScreen({
  rooms,
  anonId,
  initialQuery,
  joinedRoomIds,
}: SearchScreenProps) {
  const joinedRoomIdSet = useMemo(() => new Set(joinedRoomIds), [joinedRoomIds]);
  const { openCreateRoom } = useRoomModal();
  const { recentSearches, hydrated, addSearch, removeSearch, clearSearches } =
    useRecentSearches();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  const entrance = useStaggerEntrance(40, 45, 8);
  const emptyStateEntrance = entrance();

  // Arriving from a search bar elsewhere (e.g. Discover Rooms) with a query
  // in the URL runs that search immediately instead of showing the empty state.
  useEffect(() => {
    if (initialQuery?.trim()) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const results = useMemo(() => {
    if (submittedQuery === null) return [];
    const needle = submittedQuery.trim().toLowerCase();
    if (!needle) return [];
    return rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(needle) ||
        room.category.toLowerCase().includes(needle),
    );
  }, [rooms, submittedQuery]);

  function runSearch(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    addSearch(trimmed);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    runSearch(query);
  }

  const hasSearched = submittedQuery !== null;
  const hasResults = results.length > 0;
  const hasHistory = hydrated && recentSearches.length > 0;
  const resultEntrances = results.map(() => entrance());

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-bg">
      <SiteHeader anonId={anonId} />

      {/* pt-top clears the now-fixed nav bar, which no longer pushes this
          content down itself since it's out of normal document flow. */}
      <main className="relative z-10 flex flex-1 flex-col pb-40 pt-[73px]">
        {!hasSearched ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p
              className={`max-w-[271px] font-satoshi text-[20px] text-white ${emptyStateEntrance.className}`}
              style={emptyStateEntrance.style}
            >
              You have no trail yet. Try searching for a room.
            </p>
          </div>
        ) : hasResults ? (
          <div className="mx-auto w-full max-w-[1214px] flex-1 px-5 pt-[28px] sm:px-8 lg:px-0">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((room, i) => (
                <div key={room.id} className={resultEntrances[i].className} style={resultEntrances[i].style}>
                  <RoomCard room={room} joined={joinedRoomIdSet.has(room.id)} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <p
              className={`max-w-[271px] font-satoshi text-[20px] text-white ${emptyStateEntrance.className}`}
              style={emptyStateEntrance.style}
            >
              Oops, we could not find what you’re look for :(
            </p>
            <button
              type="button"
              onClick={openCreateRoom}
              className="flex h-8 w-[157px] items-center justify-center overflow-hidden rounded-[10px] p-px drop-shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)]"
            >
              <span
                className="flex h-full w-full items-center justify-center rounded-[6px] shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
                style={{ backgroundImage: "linear-gradient(180deg, #252628, #18191b)" }}
              >
                <span className="font-figtree text-[12px] font-medium text-subtle">
                  Create a room for it
                </span>
              </span>
            </button>
          </div>
        )}
      </main>

      {/* Dark-to-transparent gradient so the search bar stays legible over
          whatever content sits behind it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[206px]"
        style={{ backgroundImage: "linear-gradient(to top, #0c0d10, rgba(12,13,16,0))" }}
      />

      {/* pointer-events-none: on short viewports this bar's empty space can
          overlap earlier page content — without this, that dead space would
          silently swallow clicks meant for whatever's underneath. The
          actual controls opt back in with pointer-events-auto. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-20 flex flex-col items-center gap-1.5 px-5">
        <form onSubmit={handleSubmit} className="flex w-full max-w-[494px] items-center gap-1">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What are you waiting for?"
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

        {hasHistory ? (
          <div className="pointer-events-auto flex w-full max-w-[494px] items-center gap-1 rounded-[10px] bg-[#202021] p-1">
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {recentSearches.map((entry) => (
                <div
                  key={entry}
                  className="flex shrink-0 items-center gap-2 rounded-[6px] bg-[#1b1b1b] px-2 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => runSearch(entry)}
                    className="font-figtree text-[12px] text-white/70 hover:text-white"
                  >
                    {entry}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSearch(entry)}
                    aria-label={`Remove "${entry}" from recent searches`}
                    className="flex size-3.5 items-center justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="size-full" src="/icons/cancel-circle.svg" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={clearSearches}
              className="shrink-0 whitespace-nowrap px-2.5 font-figtree text-[12px] text-white/70 underline underline-offset-2 hover:text-white"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
