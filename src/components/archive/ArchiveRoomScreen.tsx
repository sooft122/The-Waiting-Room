"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/layout/SiteHeader";
import RoomSectionRow from "@/components/rooms/RoomSectionRow";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import type { Room } from "@/lib/rooms";

const FILTERS = ["All", "Ongoing", "Ended"] as const;
type Filter = (typeof FILTERS)[number];

type ArchiveRoomScreenProps = {
  /** Rooms this identity has joined. */
  rooms: Room[];
  anonId: string | null;
};

export default function ArchiveRoomScreen({ rooms, anonId }: ArchiveRoomScreenProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const entrance = useStaggerEntrance();
  const headerEntrance = entrance();

  const ongoingRooms = useMemo(
    () => rooms.filter((room) => new Date(room.date).getTime() > Date.now()),
    [rooms],
  );
  const endedRooms = useMemo(
    () => rooms.filter((room) => new Date(room.date).getTime() <= Date.now()),
    [rooms],
  );

  const counts: Record<Filter, number> = {
    All: rooms.length,
    Ongoing: ongoingRooms.length,
    Ended: endedRooms.length,
  };

  // Every room on this page is one the viewer joined, by definition.
  const joinedRoomIds = useMemo(() => new Set(rooms.map((room) => room.id)), [rooms]);

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <div className="relative min-h-screen w-full bg-bg">
      <SiteHeader anonId={anonId} />

      {/* pt compensates for the nav bar now being fixed (out of normal
          flow) instead of pushing this content down itself. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-10 px-5 pb-48 pt-[104px] sm:px-8 sm:pt-[112px] lg:px-0 lg:pt-[125px]">
        <div className={`flex flex-col gap-3 ${headerEntrance.className}`} style={headerEntrance.style}>
          <h1 className="font-satoshi text-[24px] leading-[1.08] text-white">Archive Room</h1>
          <div className="flex flex-wrap items-center gap-[7px]">
            {FILTERS.map((option) => {
              const isActive = option === filter;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`shrink-0 whitespace-nowrap rounded-[17px] px-3 py-1.5 font-satoshi text-[14px] transition-colors ${
                    isActive ? "text-black" : "bg-[#1d1d1d] text-[#d0d0d0] hover:bg-[#262626]"
                  }`}
                  style={
                    isActive
                      ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)" }
                      : undefined
                  }
                >
                  {option} ({counts[option]})
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-10">
          {filter !== "Ended" ? (
            <RoomSectionRow
              title="Ongoing"
              rooms={ongoingRooms}
              emptyMessage="No ongoing rooms yet."
              joinedRoomIds={joinedRoomIds}
            />
          ) : null}
          {filter !== "Ongoing" ? (
            <RoomSectionRow
              title="Ended"
              rooms={endedRooms}
              emptyMessage="No ended rooms yet."
              joinedRoomIds={joinedRoomIds}
            />
          ) : null}
        </div>
      </main>

      {/* Same fixed, dark-gradient-backed search bar treatment as Discover
          Rooms and Search, for consistency everywhere it appears. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[206px]"
        style={{ backgroundImage: "linear-gradient(to top, #0c0d10, rgba(12,13,16,0))" }}
      />
      {/* pointer-events-none: on short viewports this bar's empty space can
          overlap earlier page content — without this, that dead space would
          silently swallow clicks meant for whatever's underneath. The
          actual controls opt back in with pointer-events-auto. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-20 flex flex-col items-center px-5">
        <form onSubmit={handleSearchSubmit} className="flex w-full max-w-[494px] items-center gap-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
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
  );
}
